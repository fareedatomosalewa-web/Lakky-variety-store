// Admin alert migration: seen-marker + push subscriptions.
// SAFE: only ADDS a new column (default true, so old messages never badge)
// and a NEW table. No existing row is updated, nothing is deleted.
// Run: node scripts/apply-alerts.cjs
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
    await sql.unsafe(`alter table order_messages add column if not exists seen_by_admin boolean default true`);
    await sql.unsafe(`create table if not exists push_subscriptions (id serial primary key, endpoint text unique not null, p256dh text not null, auth text not null, created_at timestamptz default now())`);
    const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='order_messages' and column_name='seen_by_admin'`;
    const tabs = await sql`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='push_subscriptions'`;
    const msgs = await sql`select count(*)::int as n from order_messages`;
    const subs = await sql`select count(*)::int as n from push_subscriptions`;
    console.log('PASS: alerts ready (seen_by_admin: ' + (cols.length ? 'yes' : 'NO') + ', push_subscriptions: ' + (tabs[0].n ? 'yes' : 'NO') + ', messages kept: ' + msgs[0].n + ', subscriptions: ' + subs[0].n + ')');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
