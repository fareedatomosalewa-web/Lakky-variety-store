// Lakky Variety Store - daily database backup.
//
// What it does: connects to the shop database, writes the full schema and every
// row to a private folder OUTSIDE this project, zips it, and keeps the newest 30
// copies. It never writes inside the git repo, so a backup can never be pushed
// to GitHub.
//
// Run it by hand:      node scripts/db-backup.cjs
// Run it daily:        powershell -ExecutionPolicy Bypass -File scripts/install-daily-backup.ps1
// Choose a folder:     set BACKUP_DIR=C:\some\private\folder
// Keep more copies:    set BACKUP_KEEP=60
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { connect, qid } = require('./lib/db-connect.cjs');

const PROJECT_ROOT = path.join(__dirname, '..');
const ROOT = path.resolve(process.env.BACKUP_DIR || path.join(os.homedir(), 'Lakky-Backups'));
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP || 30));
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const NAME = 'lakky-db-' + stamp;
const FOLDER = path.join(ROOT, NAME);
const DATA = path.join(FOLDER, 'data');
const ZIP = path.join(ROOT, NAME + '.zip');

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function log(line) {
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.appendFileSync(path.join(ROOT, 'backup.log'), new Date().toISOString() + '  ' + line + '\n');
  } catch { /* logging must never break a backup */ }
}

(async () => {
  let sql;
  try {
    // Hard safety rule: never write a backup inside the git project.
    if (ROOT.toLowerCase().startsWith(PROJECT_ROOT.toLowerCase())) {
      console.error('REFUSED: BACKUP_DIR is inside the project folder. Choose a private folder outside it.');
      process.exit(2);
    }

    fs.mkdirSync(DATA, { recursive: true });
    const c = await connect();
    sql = c.sql;

    const tables = await sql`
      select c.relname as name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relkind='r'
      order by c.relname`;

    const cols = await sql`
      select table_name, column_name, ordinal_position,
             format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull as not_null,
             pg_get_expr(d.adbin, d.adrelid) as default_expr,
             a.attidentity as identity,
             a.attgenerated as generated
      from information_schema.columns ic
      join pg_attribute a on a.attrelid = (quote_ident(ic.table_schema)||'.'||quote_ident(ic.table_name))::regclass
                          and a.attname = ic.column_name and a.attnum > 0
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where ic.table_schema='public'
      order by ic.table_name, ic.ordinal_position`;

    const cons = await sql`
      select c.relname as tbl, co.conname as name, co.contype,
             pg_get_constraintdef(co.oid) as def
      from pg_constraint co
      join pg_class c on c.oid = co.conrelid
      where co.connamespace='public'::regnamespace
      order by c.relname, case co.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 when 'f' then 4 else 5 end, co.conname`;

    const idx = await sql`
      select tablename, indexname, indexdef from pg_indexes
      where schemaname='public'
        and indexname not in (select conname from pg_constraint where connamespace='public'::regnamespace and contype in ('p','u'))
      order by tablename, indexname`;

    const seqs = await sql`
      select schemaname, sequencename, start_value, increment_by, min_value, max_value, cycle
      from pg_sequences where schemaname='public' order by sequencename`;
    const seqVals = [];
    for (const s of seqs) {
      const r = await sql.unsafe(`select last_value, is_called from public.${qid(s.sequencename)}`);
      seqVals.push({ ...s, last_value: String(r[0].last_value), is_called: r[0].is_called });
    }

    const policies = await sql`
      select tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies where schemaname='public' order by tablename, policyname`;

    const rls = await sql`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' order by c.relname`;

    // ---- schema.sql ----
    const L = [];
    L.push('-- Lakky Variety Store - logical backup of the public schema');
    L.push('-- Generated: ' + new Date().toISOString());
    L.push('-- WARNING: contains customer data. Store privately.');
    L.push('');
    L.push('BEGIN;');
    L.push('');
    L.push('-- Sequences');
    for (const s of seqVals) {
      L.push(`CREATE SEQUENCE IF NOT EXISTS public.${qid(s.sequencename)} INCREMENT BY ${s.increment_by} MINVALUE ${s.min_value} MAXVALUE ${s.max_value} START WITH ${s.start_value}${s.cycle ? ' CYCLE' : ' NO CYCLE'};`);
    }
    L.push('');
    L.push('-- Tables');
    for (const t of tables) {
      const tc = cols.filter((x) => x.table_name === t.name);
      L.push(`CREATE TABLE IF NOT EXISTS public.${qid(t.name)} (`);
      L.push(tc.map((x) => {
        let line = `  ${qid(x.column_name)} ${x.type}`;
        if (x.identity === 'a') line += ' GENERATED ALWAYS AS IDENTITY';
        else if (x.identity === 'd') line += ' GENERATED BY DEFAULT AS IDENTITY';
        if (x.generated === 's') line += ' GENERATED ALWAYS AS (' + (x.default_expr || '') + ') STORED';
        else if (x.default_expr) line += ' DEFAULT ' + x.default_expr;
        if (x.not_null) line += ' NOT NULL';
        return line;
      }).join(',\n'));
      L.push(');');
      L.push('');
    }
    L.push('-- Primary keys / unique / check constraints');
    for (const k of cons.filter((x) => x.contype !== 'f')) {
      L.push(`ALTER TABLE public.${qid(k.tbl)} ADD CONSTRAINT ${qid(k.name)} ${k.def};`);
    }
    L.push('');
    L.push('-- Foreign keys');
    for (const k of cons.filter((x) => x.contype === 'f')) {
      L.push(`ALTER TABLE public.${qid(k.tbl)} ADD CONSTRAINT ${qid(k.name)} ${k.def};`);
    }
    L.push('');
    L.push('-- Indexes');
    for (const i of idx) L.push(i.indexdef + ';');
    L.push('');
    L.push('-- Sequence values at backup time');
    for (const s of seqVals) {
      L.push(`SELECT setval('public.${qid(s.sequencename)}', ${s.last_value}, ${s.is_called});`);
    }
    L.push('');
    L.push('-- Row Level Security state');
    for (const r of rls) {
      L.push(`ALTER TABLE public.${qid(r.relname)} ENABLE ROW LEVEL SECURITY;`);
      if (r.relforcerowsecurity) L.push(`ALTER TABLE public.${qid(r.relname)} FORCE ROW LEVEL SECURITY;`);
    }
    for (const p of policies) {
      const roles = p.roles.length ? p.roles.map((r) => qid(r)).join(', ') : 'PUBLIC';
      L.push(`CREATE POLICY ${qid(p.policyname)} ON public.${qid(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}${p.qual ? ' USING (' + p.qual + ')' : ''}${p.with_check ? ' WITH CHECK (' + p.with_check + ')' : ''};`);
    }
    L.push('');
    L.push('COMMIT;');
    const schemaSql = L.join('\n') + '\n';
    fs.writeFileSync(path.join(FOLDER, 'schema.sql'), schemaSql);

    // ---- data ----
    const manifest = { generatedAt: new Date().toISOString(), tables: {}, files: {} };
    let totalRows = 0;
    for (const t of tables) {
      const tc = cols.filter((x) => x.table_name === t.name);
      const rows = await sql.unsafe(`select * from public.${qid(t.name)}`);
      const clean = rows.map((r) => {
        const o = {};
        for (const x of tc) {
          let v = r[x.column_name];
          if (v instanceof Date) v = v.toISOString();
          else if (typeof v === 'bigint') v = v.toString();
          else if (Buffer.isBuffer(v)) v = { __bytea: v.toString('base64') };
          o[x.column_name] = v;
        }
        return o;
      });
      const buf = Buffer.from(JSON.stringify({ table: t.name, columns: tc.map((x) => x.column_name), rows: clean }, null, 2));
      fs.writeFileSync(path.join(DATA, t.name + '.json'), buf);
      manifest.tables[t.name] = { rows: clean.length, columns: tc.length };
      manifest.files['data/' + t.name + '.json'] = { bytes: buf.length, sha256: sha256(buf) };
      totalRows += clean.length;
    }
    fs.writeFileSync(path.join(FOLDER, 'manifest.json'), JSON.stringify(manifest, null, 2));

    fs.writeFileSync(path.join(FOLDER, 'HOW-TO-RESTORE.txt'), [
      'Lakky Variety Store database backup',
      'Created: ' + new Date().toISOString(),
      '',
      'This zip holds your full shop database: structure + every row.',
      'It contains customer names, phones, emails and scrambled passwords.',
      'Keep it private. Never put it in GitHub, email it publicly, or post it.',
      '',
      'To CHECK that it restores correctly (safe - it builds a temporary copy',
      'in the database and deletes it again):',
      '',
      '  cd Lakky-variety-store-project',
      '  node scripts/db-restore-verify.cjs "' + ZIP + '"',
      '',
      'To restore for real after a disaster, ask for help first - a real restore',
      'overwrites current data.',
      '',
    ].join('\n'));

    await sql.end();

    // ---- zip + clean up the loose folder ----
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Compress-Archive -Path '${FOLDER}\\*' -DestinationPath '${ZIP}' -Force`], { stdio: 'ignore' });
    fs.rmSync(FOLDER, { recursive: true, force: true });
    const zipBuf = fs.readFileSync(ZIP);
    const hash = sha256(zipBuf);
    fs.writeFileSync(ZIP + '.sha256', hash + '  ' + path.basename(ZIP) + '\n');

    // ---- retention ----
    const old = fs.readdirSync(ROOT)
      .filter((f) => /^lakky-db-.*\.zip$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(ROOT, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const o of old.slice(KEEP)) {
      try { fs.rmSync(path.join(ROOT, o.f), { force: true }); } catch {}
      try { fs.rmSync(path.join(ROOT, o.f + '.sha256'), { force: true }); } catch {}
    }

    log(`OK ${NAME}.zip ${tables.length} tables ${totalRows} rows ${zipBuf.length} bytes`);
    console.log('BACKUP_OK');
    console.log('file      = ' + ZIP);
    console.log('tables    = ' + tables.length);
    console.log('rows      = ' + totalRows);
    console.log('size      = ' + zipBuf.length + ' bytes');
    console.log('sha256    = ' + hash);
    console.log('kept      = ' + Math.min(KEEP, old.length) + ' newest backup(s) in ' + ROOT);
    console.log('restore   = node scripts/db-restore-verify.cjs "' + ZIP + '"');
  } catch (e) {
    log('FAIL ' + (e.code || '') + ' ' + String(e.message).slice(0, 200));
    console.error('BACKUP_FAILED ' + (e.code || '') + ' ' + String(e.message).slice(0, 300));
    try { if (sql) await sql.end(); } catch {}
    process.exit(1);
  }
})();
