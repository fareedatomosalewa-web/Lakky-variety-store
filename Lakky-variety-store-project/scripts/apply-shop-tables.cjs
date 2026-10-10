// V1 Shop build: orders, fulfilment, catalogue, accounts, engagement tables.
// Idempotent. Prints codes only, never secrets.
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
const DDL = `
alter table pending_refs add column if not exists reference_id text unique;
alter table pending_refs add column if not exists credit_used integer default 0;
alter table pending_refs add column if not exists coupon_code text;
alter table products add column if not exists wholesale_tiers jsonb;
alter table products add column if not exists restocked_at timestamptz;
alter table products add column if not exists discount_type text;
alter table products add column if not exists discount_value integer;
alter table products add column if not exists discount_start timestamptz;
alter table products add column if not exists discount_end timestamptz;
alter table products add column if not exists new_tag_days integer;
alter table customers add column if not exists email text;
alter table customers add column if not exists password_hash text;
alter table settings add column if not exists stockpile_fee_per_day integer default 50;
alter table settings add column if not exists max_stockpile_days integer default 60;
alter table settings add column if not exists credit_cash_minimum integer default 5000;
alter table settings add column if not exists restock_tag_days integer default 2;
alter table settings add column if not exists new_tag_days integer default 7;
alter table settings add column if not exists report_window_hours integer default 48;
alter table settings add column if not exists reminder_first_days integer default 2;
alter table settings add column if not exists reminder_every_days integer default 2;
alter table settings add column if not exists pickup_location text default '';
alter table settings add column if not exists pickup_reveal boolean default false;
alter table settings add column if not exists shop_hours text default '';
alter table settings add column if not exists announcement_on boolean default false;
alter table settings add column if not exists announcement_text text default '';
alter table settings add column if not exists social_links jsonb default '[]';
alter table settings add column if not exists about_text text default '';
alter table settings add column if not exists help_text text default '';
create table if not exists order_messages (id serial primary key, order_id integer not null references orders(id) on delete cascade, sender text not null, text text not null, created_at timestamptz default now());
create table if not exists refund_requests (id serial primary key, order_id integer references orders(id) on delete set null, customer_id integer references customers(id) on delete set null, kind text not null, amount integer not null default 0, bank_name text default '', account_number text default '', account_name text default '', status text default 'pending', created_at timestamptz default now());
create table if not exists order_events (id serial primary key, order_id integer references orders(id) on delete cascade, actor text not null, action text not null, note text default '', created_at timestamptz default now());
create table if not exists reviews (id serial primary key, product_name text not null, customer_name text default '', order_id integer references orders(id) on delete set null, stars integer not null default 5, note text default '', hidden boolean default false, created_at timestamptz default now());
create table if not exists problem_reports (id serial primary key, order_id integer references orders(id) on delete cascade, reason text not null, photo_url text default '', status text default 'open', created_at timestamptz default now());
create table if not exists coupons (code text primary key, percent integer not null, expiry timestamptz, usage_limit integer not null default 1, used integer not null default 0);
create table if not exists wishlist (id serial primary key, customer_id integer not null references customers(id) on delete cascade, product_name text not null, created_at timestamptz default now());
create table if not exists notification_prefs (id serial primary key, customer_id integer not null references customers(id) on delete cascade, type text not null, off boolean default false);
create table if not exists product_addons (id serial primary key, product_id integer not null references products(id) on delete cascade, name text not null, price integer not null, stock integer default 0, active boolean default true);
create table if not exists customer_sessions (id text primary key, customer_id integer not null references customers(id) on delete cascade, expires_at timestamptz not null);
create table if not exists staff_invites (id text primary key, email text not null, status text default 'pending', created_at timestamptz default now());
create table if not exists shop_events (id serial primary key, customer_id integer references customers(id) on delete set null, kind text not null, detail text default '', created_at timestamptz default now());
`;
(async () => {
  const conn = getConn();
  if (!conn) { console.log('FAIL: no connection string'); process.exit(1); }
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
    await sql.unsafe(DDL);
    const r = await sql`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('order_messages','refund_requests','order_events','reviews','problem_reports','coupons','wishlist','notification_prefs','product_addons','customer_sessions','staff_invites','shop_events')`;
    console.log('PASS: shop tables present: ' + r[0].n + '/12');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
