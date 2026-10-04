// Creates v1.7 auth tables (user/session/account/verification/admin_meta).
// Reads connection from local .env.local. Prints codes only, never the secret.
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
    await sql`create table if not exists "user" (id text primary key, name text, email text not null unique, email_verified boolean default false, image text, role text default 'customer', created_at timestamptz default now(), updated_at timestamptz default now())`;
    await sql`create table if not exists session (id text primary key, expires_at timestamptz not null, token text not null unique, created_at timestamptz default now(), updated_at timestamptz default now(), ip_address text, user_agent text, user_id text not null references "user"(id) on delete cascade)`;
    await sql`create table if not exists account (id text primary key, account_id text not null, provider_id text not null, user_id text not null references "user"(id) on delete cascade, access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz, refresh_token_expires_at timestamptz, scope text, password text, created_at timestamptz default now(), updated_at timestamptz default now())`;
    await sql`create table if not exists verification (id text primary key, identifier text not null, value text not null, expires_at timestamptz not null, created_at timestamptz default now(), updated_at timestamptz default now())`;
    await sql`create table if not exists admin_meta (key text primary key, value text not null)`;
    const r = await sql`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('user','session','account','verification','admin_meta')`;
    console.log('PASS: auth tables present: ' + r[0].n + '/5');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
