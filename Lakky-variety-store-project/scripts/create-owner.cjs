// Creates the single owner (ADMIN_EMAIL + ADMIN_PASSWORD from local .env.local).
// Prints a recovery key ONCE to this terminal. It is never written to any file,
// never committed, never sent anywhere. Save it in a password manager.
// Refuses to run if an owner already exists (use a future reset flow instead).
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
    const existing = await sql`select id from "user" where role='admin' limit 1`;
    if (existing.length) { console.log('FAIL: an owner already exists — refusing to create another'); await sql.end(); process.exit(1); }

    const { betterAuth } = await import('better-auth');
    const { drizzleAdapter } = await import('better-auth/adapters/drizzle');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const schema = await import('../db/schema.ts');
    const tables = { user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications };
    const auth = betterAuth({
      database: drizzleAdapter(drizzle(sql, { schema: tables }), { provider: 'pg', schema: tables }),
      emailAndPassword: { enabled: true },
      user: { additionalFields: { role: { type: 'string', defaultValue: 'customer', input: false } } },
    });
    await auth.api.signUpEmail({ body: { email, password, name: 'Owner' } });
    await sql`update "user" set role='admin' where email=${email}`;

    const key = crypto.randomBytes(24).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(key, salt, 64).toString('hex');
    await sql`insert into admin_meta (key, value) values ('recovery_hash', ${salt + ':' + hash}) on conflict (key) do update set value=excluded.value`;

    console.log('PASS: owner created for the email in .env.local (address never printed)');
    console.log('RECOVERY KEY (once only — save it now, it will never be shown again):');
    console.log(key);
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
