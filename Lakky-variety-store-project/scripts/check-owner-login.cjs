// Read-only check: does ADMIN_EMAIL + ADMIN_PASSWORD in .env.local match the owner in the database?
// Changes nothing. Prints only PASS/FAIL lines (no secrets).
const fs = require('fs');
const path = require('path');

function readEnv(key) {
  for (const p of [path.join(process.cwd(), '.env.local'), path.join(__dirname, '..', '.env.local')]) {
    try {
      const t = fs.readFileSync(p, 'utf8');
      const m = t.match(new RegExp('^' + key + '=(.+)$', 'm'));
      if (m) return m[1].trim().replace(/^"|"$/g, '');
    } catch {}
  }
  return '';
}

(async () => {
  const email = readEnv('ADMIN_EMAIL');
  const password = readEnv('ADMIN_PASSWORD');
  const conn = readEnv('DATABASE_URL');
  const host = (conn.split('@').pop() || '').split('/')[0];
  const project = ((conn.match(/postgres\.([a-z0-9]+)/) || [])[1] || 'unknown');
  console.log('database project id: ' + project + '  host: ' + host);
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
    const users = await sql`select id, email, role from "user" where lower(email)=lower(${email})`;
    if (!users.length) { console.log('FAIL: no user with ADMIN_EMAIL in this database'); }
    else {
      const u = users[0];
      console.log('user found, role=' + u.role + (u.email === email ? '' : ' (email case differs!)'));
      const acc = await sql`select password from account where user_id=${u.id} and provider_id='credential'`;
      if (!acc.length || !acc[0].password) console.log('FAIL: user has no password account row');
      else {
        const { verifyPassword } = await import('better-auth/crypto');
        const ok = await verifyPassword({ hash: acc[0].password, password });
        console.log(ok ? 'PASS: password in .env.local matches the database' : 'FAIL: password does NOT match the database');
      }
    }
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown') + ' ' + (e.message || '')); try { await sql.end(); } catch {} process.exit(1); }
})();
