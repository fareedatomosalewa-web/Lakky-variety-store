// Sets owner password from env OWNER_NEW_PW + recovery key file. Prints verdicts only, never values.
// Usage (owner types password blind):
//   $s = Read-Host -AsSecureString "New owner password"
//   $env:OWNER_NEW_PW = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
//   node scripts/set-password.cjs; $env:OWNER_NEW_PW = $null
const fs = require('fs');
const crypto = require('crypto');
const ENV = 'C:\\Users\\lakky\\Documents\\Default Project\\Lakky-variety-store-project\\.env.local';
const KEYFILE = 'C:\\Users\\lakky\\Documents\\LAKKY-RECOVERY-KEY.txt';
function readEnv(key) {
  const t = fs.readFileSync(ENV, 'utf8');
  const m = t.match(new RegExp('^' + key + '=(.+)$', 'm'));
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}
(async () => {
  const conn = readEnv('DATABASE_URL');
  const email = readEnv('ADMIN_EMAIL');
  const password = process.env.OWNER_NEW_PW || '';
  if (!email || !password) { console.log('FAIL: OWNER_NEW_PW env missing (type it blind, never paste in chat)'); process.exit(1); }
  let key = '';
  try {
    const lines = fs.readFileSync(KEYFILE, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    key = lines[lines.length - 1];
  } catch { console.log('FAIL: key file not found'); process.exit(1); }
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
    const meta = await sql`select value from admin_meta where key='recovery_hash'`;
    if (!meta.length) { console.log('FAIL: no recovery hash stored'); await sql.end(); process.exit(1); }
    const parts = String(meta[0].value).split(':');
    if (crypto.scryptSync(key, parts[0], 64).toString('hex') !== parts[1]) { console.log('FAIL: recovery key mismatch — refused'); await sql.end(); process.exit(1); }
    const { betterAuth } = await import('better-auth');
    const { drizzleAdapter } = await import('better-auth/adapters/drizzle');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { pathToFileURL } = require('url');
    const schema = await import(pathToFileURL('C:\\Users\\lakky\\Documents\\Default Project\\Lakky-variety-store-project\\db\\schema.ts').href);
    const tables = { user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications };
    const auth = betterAuth({
      database: drizzleAdapter(drizzle(sql, { schema: tables }), { provider: 'pg', schema: tables }),
      emailAndPassword: { enabled: true },
      user: { additionalFields: { role: { type: 'string', defaultValue: 'customer', input: false } } },
    });
    await sql`delete from "user" where email=${email}`;
    await auth.api.signUpEmail({ body: { email, password, name: 'Owner' } });
    await sql`update "user" set role='admin' where email=${email}`;
    console.log('PASS: owner password updated (value never shown)');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
