// Login e2e (self-cleaning): wrong password rejected, temp owner signs in,
// session validates with role=admin through the REAL getSession path, then cleanup.
// Reads connection from local .env.local. Prints codes/counts only, never secrets.
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
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; throw new Error('stop'); } console.log('PASS:', m); };
(async () => {
  const conn = readEnv('DATABASE_URL');
  if (!conn) { console.error('FAIL: no connection string'); process.exit(1); }
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
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

    // 1. Wrong credentials must fail
    let wrongFailed = false;
    try { await auth.api.signInEmail({ body: { email: 'nobody@example.com', password: 'wrong-wrong-wrong' } }); }
    catch { wrongFailed = true; }
    assert(wrongFailed, 'e2e: wrong email+password rejected');

    // 2. Temp owner lifecycle
    const stamp = Date.now().toString(36);
    const email = `e2e-${stamp}@example.com`;
    const password = `E2e-${stamp}-xQ9!`;
    await auth.api.signUpEmail({ body: { email, password, name: 'E2E' } });
    await sql`update "user" set role='admin' where email=${email}`;
    const signed = await auth.api.signInEmail({ body: { email, password } });
    assert(!!signed, 'e2e: temp owner signs in with correct password');
    // Forward the real signed cookies exactly as a browser would (same gate path as the app)
    const resp = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    const jar = new Headers();
    for (const c of resp.headers.getSetCookie()) jar.append('cookie', c.split(';')[0]);
    const sess = await auth.api.getSession({ headers: jar });
    assert(!!sess?.user, 'e2e: session validates through getSession (admin gate path)');
    assert(sess.user.role === 'admin', 'e2e: session carries role=admin');

    // 3. Cleanup — temp user gone, nothing left behind
    await sql`delete from "user" where email=${email}`;
    const left = await sql`select count(*)::int as n from "user" where email=${email}`;
    assert(left[0].n === 0, 'e2e: temp user cleaned up');
    console.log('ALL LOGIN E2E CHECKS PASSED');
    await sql.end();
  } catch (e) {
    if (!process.exitCode) console.error('FAIL code=' + (e.code || 'unknown'));
    try {
      const postgres2 = require('postgres');
      const sql2 = postgres2(conn, { prepare: false });
      await sql2`delete from "user" where email like 'e2e-%@example.com'`.catch(() => {});
      await sql2.end().catch(() => {});
    } catch {}
    try { await sql.end(); } catch {}
    process.exit(1);
  }
})();
