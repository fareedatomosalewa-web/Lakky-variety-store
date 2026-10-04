// Applies drizzle/rls-lockdown.sql. Prints codes only, never the secret.
const fs = require('fs');
const path = require('path');
function getConn() {
  for (const p of [path.join(process.cwd(), '.env.local'), path.join(__dirname, '..', '.env.local')]) {
    try {
      const t = fs.readFileSync(p, 'utf8');
      const m = t.match(/^DATABASE_URL=(.+)$/m);
      if (m) return m[1].trim().replace(/^"|"$/g, '');
    } catch {}
  }
  return '';
}
(async () => {
  const conn = getConn();
  if (!conn) { console.log('FAIL: no connection string'); process.exit(1); }
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
    const q = fs.readFileSync(path.join(__dirname, '..', 'drizzle', 'rls-lockdown.sql'), 'utf8');
    await sql.unsafe(q);
    console.log('PASS: RLS lockdown applied');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
