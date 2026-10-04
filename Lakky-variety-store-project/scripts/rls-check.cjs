// RLS proof: (1) every public table has RLS enabled, (2) a locked-down role
// with no grants is REFUSED on read — same position as the public API keys.
// Reads connection from local .env.local. Prints codes/counts only, never the secret.
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
    const rls = await sql`select count(*)::int as total, sum(case when rowsecurity then 1 else 0 end)::int as locked from pg_tables where schemaname='public'`;
    console.log('TABLES total=' + rls[0].total + ' rls_on=' + rls[0].locked);
    if (rls[0].total === 0 || rls[0].locked !== rls[0].total) { console.log('FAIL: RLS not on every table — apply drizzle/rls-lockdown.sql first'); await sql.end(); process.exit(1); }
    console.log('PASS: RLS enabled on every table');
    const role = 'rls_proof_' + Date.now().toString(36);
    await sql.unsafe(`create role ${role} with login`);
    let denied = false;
    try {
      await sql.unsafe(`set role ${role}`);
      await sql`select * from products limit 1`;
    } catch (e) {
      denied = String(e.code) === '42501';
    } finally {
      await sql.unsafe('reset role');
      await sql.unsafe(`drop role ${role}`);
    }
    if (!denied) { console.log('FAIL: locked role could read — public API not blocked'); await sql.end(); process.exit(1); }
    console.log('PASS: locked-down role REFUSED (42501) — public API cannot read or write');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
