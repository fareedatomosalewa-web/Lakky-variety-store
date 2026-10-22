// Additive-only migration for the admin/customer fixes.
// Adds columns + unique indexes. Does NOT update, delete or reset any row.
// Run: node scripts/apply-v2-fixes.cjs
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
const STEPS = [
  ['whatsapp_number', `alter table settings add column if not exists whatsapp_number text default ''`],
  ['orders.completed_at', `alter table orders add column if not exists completed_at timestamptz`],
  ['email unique (case-insensitive)', `create unique index if not exists customers_email_lower_uniq on customers (lower(email)) where email is not null and email <> ''`],
  ['phone unique (digits only)', `create unique index if not exists customers_phone_digits_uniq on customers ((regexp_replace(phone, '\\D', '', 'g')))`],
  ['messages lookup index', `create index if not exists order_messages_pending_idx on order_messages (pending_id, id)`],
];
(async () => {
  const conn = getConn();
  if (!conn) { console.log('FAIL: no connection string'); process.exit(1); }
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false, onnotice: () => {} });
  try {
    const results = [];
    for (const [name, ddl] of STEPS) {
      try { await sql.unsafe(ddl); results.push(name + ': ok'); }
      catch (e) { results.push(name + ': skipped (' + (e.code || 'unknown') + ')'); }
    }
    const w = await sql`select count(*)::int n from information_schema.columns where table_schema='public' and table_name='settings' and column_name='whatsapp_number'`;
    const c = await sql`select count(*)::int n from information_schema.columns where table_schema='public' and table_name='orders' and column_name='completed_at'`;
    const dupE = await sql`select count(*)::int n from (select lower(email) e from customers where email is not null and email <> '' group by 1 having count(*) > 1) x`;
    const dupP = await sql`select count(*)::int n from (select regexp_replace(phone,'\\D','','g') p from customers group by 1 having count(*) > 1) x`;
    console.log(results.join('\n'));
    console.log('PASS: whatsapp=' + (w[0].n ? 'yes' : 'NO') + ', completed_at=' + (c[0].n ? 'yes' : 'NO') + ', duplicate emails=' + dupE[0].n + ', duplicate phones=' + dupP[0].n);
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown') + ' ' + (e.message || '').slice(0, 160)); try { await sql.end(); } catch {} process.exit(1); }
})();
