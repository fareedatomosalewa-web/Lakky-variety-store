// Resets the existing owner's login to ADMIN_EMAIL + ADMIN_PASSWORD from local .env.local.
// Use when create-owner.cjs says "an owner already exists" but login fails.
// Only touches the single admin user's email + password. Nothing else changes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  if (!email || !password || password.includes('change-me')) {
    console.log('FAIL: set real ADMIN_EMAIL + strong ADMIN_PASSWORD in .env.local first (placeholders not allowed)');
    process.exit(1);
  }
  if (!conn) { console.log('FAIL: no connection string'); process.exit(1); }
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
    const admins = await sql`select id, email from "user" where role='admin'`;
    if (admins.length !== 1) { console.log('FAIL: expected exactly 1 owner, found ' + admins.length); await sql.end(); process.exit(1); }
    const admin = admins[0];
    if (admin.email !== email) console.log('NOTE: owner email in database differed from .env.local — updating it to match');

    const { hashPassword } = await import('better-auth/crypto');
    const hash = await hashPassword(password);
    await sql`update "user" set email=${email}, updated_at=now() where id=${admin.id}`;
    const updated = await sql`update account set password=${hash}, updated_at=now() where user_id=${admin.id} and provider_id='credential' returning id`;
    if (!updated.length) {
      await sql`insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
                values (${crypto.randomUUID()}, ${admin.id}, 'credential', ${admin.id}, ${hash}, now(), now())`;
    }
    await sql`delete from session where user_id=${admin.id}`;
    console.log('PASS: owner login reset — log in with ADMIN_EMAIL + ADMIN_PASSWORD from .env.local');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown') + ' ' + (e.message || '')); try { await sql.end(); } catch {} process.exit(1); }
})();
