// Lakky Variety Store - prove that a backup really restores.
//
// It opens a backup zip, rebuilds the whole database structure in a TEMPORARY
// schema, copies every row in, compares row counts table by table, then throws
// the temporary copy away. Your live data is never touched.
//
//   node scripts/db-restore-verify.cjs "C:\Users\you\Lakky-Backups\lakky-db-....zip"
//   node scripts/db-restore-verify.cjs "C:\Users\you\Lakky-Backups\lakky-db-...."   (unzipped folder)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { connect, qid } = require('./lib/db-connect.cjs');

function log(line) {
  try {
    const root = process.env.BACKUP_DIR || path.join(os.homedir(), 'Lakky-Backups');
    fs.mkdirSync(root, { recursive: true });
    fs.appendFileSync(path.join(root, 'backup.log'), new Date().toISOString() + '  ' + line + '\n');
  } catch { /* ignore */ }
}

function unpack(input) {
  const stat = fs.statSync(input);
  if (stat.isDirectory()) return { dir: input, cleanup: null };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lakky-restore-'));
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -Path '${input}' -DestinationPath '${tmp}' -Force`], { stdio: 'ignore' });
  return { dir: tmp, cleanup: tmp };
}

(async () => {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node scripts/db-restore-verify.cjs "<backup zip or folder>"');
    process.exit(2);
  }
  if (!fs.existsSync(input)) {
    console.error('File not found: ' + input);
    process.exit(2);
  }

  let sql;
  let cleanup = null;
  const schema = 'restore_check_' + Date.now();
  try {
    const unpacked = unpack(input);
    cleanup = unpacked.cleanup;
    const dir = unpacked.dir;
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

    const c = await connect();
    sql = c.sql;

    let ddl = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8');
    ddl = ddl
      .replace(/^\s*BEGIN;\s*$/m, '')
      .replace(/^\s*COMMIT;\s*$/m, '')
      .replace(/public\./g, schema + '.');

    await sql.unsafe('BEGIN');
    await sql.unsafe('CREATE SCHEMA ' + qid(schema));
    await sql.unsafe('SET LOCAL search_path = ' + qid(schema) + ', public');
    await sql.unsafe(ddl);
    await sql.unsafe('SET LOCAL session_replication_role = replica');

    const results = [];
    for (const table of Object.keys(manifest.tables)) {
      const f = JSON.parse(fs.readFileSync(path.join(dir, 'data', table + '.json'), 'utf8'));
      for (const row of f.rows) {
        const vals = f.columns.map((k) => {
          const v = row[k];
          if (v && typeof v === 'object' && typeof v.__bytea === 'string') return Buffer.from(v.__bytea, 'base64');
          return v;
        });
        const cols = f.columns.map((k) => qid(k)).join(',');
        const ph = f.columns.map((_, n) => '$' + (n + 1)).join(',');
        await sql.unsafe(`insert into ${qid(schema)}.${qid(table)} (${cols}) values (${ph})`, vals);
      }
      const r = await sql.unsafe(`select count(*)::int c from ${qid(schema)}.${qid(table)}`);
      results.push({ table, expected: manifest.tables[table].rows, got: r[0].c });
    }

    await sql.unsafe('ROLLBACK');

    const bad = results.filter((x) => x.expected !== x.got);
    const totalRows = results.reduce((a, b) => a + b.expected, 0);
    console.log('BACKUP_FILE = ' + path.resolve(input));
    console.log('TABLES      = ' + results.length);
    console.log('ROWS        = ' + totalRows);
    console.log('MISMATCHES  = ' + (bad.length ? JSON.stringify(bad) : 'none'));
    console.log(bad.length ? 'RESTORE_FAILED' : 'RESTORE_OK');
    log((bad.length ? 'RESTORE_FAILED ' : 'RESTORE_OK ') + path.basename(input) + ' tables=' + results.length + ' rows=' + totalRows);
    await sql.end();
    if (cleanup) { try { fs.rmSync(cleanup, { recursive: true, force: true }); } catch {} }
    process.exit(bad.length ? 1 : 0);
  } catch (e) {
    log('RESTORE_ERROR ' + (e.code || '') + ' ' + String(e.message).slice(0, 200));
    console.error('RESTORE_ERROR ' + (e.code || '') + ' ' + String(e.message).slice(0, 300));
    try { if (sql) await sql.unsafe('ROLLBACK'); } catch {}
    try { if (sql) await sql.unsafe('DROP SCHEMA IF EXISTS ' + qid(schema) + ' CASCADE'); } catch {}
    try { if (sql) await sql.end(); } catch {}
    if (cleanup) { try { fs.rmSync(cleanup, { recursive: true, force: true }); } catch {} }
    process.exit(1);
  }
})();
