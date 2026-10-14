// One Order ID + pre-confirm chat migration. Idempotent. Prints codes only, never secrets.
// Run: node scripts/apply-oneid-chat.cjs
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
    await sql`create sequence if not exists order_serial_seq start 1`;
    await sql`alter table pending_refs add column if not exists display_id text unique`;
    try {
      await sql.unsafe(`alter table pending_refs add constraint pending_refs_display_id_unique unique (display_id)`);
    } catch (e) { if (e.code !== 'duplicate_object' && e.code !== '42P07') throw e; }
    await sql`alter table order_messages add column if not exists pending_id integer references pending_refs(id) on delete cascade`;
    try {
      await sql.unsafe(`alter table order_messages add constraint order_messages_pending_fk foreign key (pending_id) references pending_refs(id) on delete cascade`);
    } catch (e) { if (e.code !== 'duplicate_object' && e.code !== '42P07') throw e; }
    await sql.unsafe(`alter table order_messages alter column order_id drop not null`);
    // Backfill: old pendings without an Order ID get LVS-serial-last4 (serial + last 4 of phone).
    const filled = await sql.unsafe(`update pending_refs p set display_id = 'LVS-' || lpad(nextval('order_serial_seq')::text, 3, '0') || '-' || right(regexp_replace(c.phone, '\\D', '', 'g'), 4) from customers c where c.id = p.customer_id and p.display_id is null returning p.id`);
    const left = await sql`select count(*)::int as n from pending_refs where display_id is null`;
    console.log('PASS: one-id + chat ready (backfilled ' + filled.length + ', still without ID: ' + left[0].n + ')');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
