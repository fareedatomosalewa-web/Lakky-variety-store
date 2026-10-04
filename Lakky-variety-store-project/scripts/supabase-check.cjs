// Connectivity check for the pooled pilot DB.
// Reads the connection string from local .env.local (git-blocked).
// Prints host suffix + pooled-port status + table list only.
// Failures print short codes only — never the connection string.
const fs = require('fs');
const path = require('path');
function getConnStr() {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '.env.local'),
  ];
  for (const p of candidates) {
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const m = txt.match(/^DATABASE_URL=(.+)$/m);
      if (m) return m[1].trim().replace(/^"|"$/g, '');
    } catch {}
  }
  return '';
}
function shortCode(e) {
  const c = e && (e.code || e.errno);
  return c ? String(c) : 'unknown';
}
(async () => {
  const conn = getConnStr();
  if (!conn) { console.error('FAIL: no DATABASE_URL line in .env.local'); process.exit(1); }
  const pooled = conn.includes(':6543/') ? 'YES' : 'NO';
  console.log('PASS: connection string present, pooled-6543=' + pooled);
  let pg;
  try { pg = require('postgres'); }
  catch (e) { console.error('FAIL: db driver missing, code=' + shortCode(e)); process.exit(1); }
  let sql;
  try {
    sql = pg(conn, { prepare: false, connect_timeout: 15 });
    const rows = await sql`select table_name from information_schema.tables where table_schema='public' order by 1`;
    const names = rows.map(r => r.table_name);
    console.log('PASS: connected to pilot DB (pooled mode, prepare:false)');
    console.log('TABLES: ' + (names.length ? names.join(',') : '(none yet)'));
    const want = ['products', 'variant_skus', 'orders', 'settings'];
    const missing = want.filter(t => !names.includes(t));
    if (missing.length) console.log('NOTE: missing core tables: ' + missing.join(','));
    else console.log('PASS: core tables present (products, variant_skus, orders, settings)');
    await sql.end();
  } catch (e) {
    console.error('FAIL: connection failed, code=' + shortCode(e));
    try { if (sql) await sql.end(); } catch {}
    process.exit(1);
  }
})();
