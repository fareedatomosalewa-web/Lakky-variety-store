// Fresh pilot seed — products + variants + addon + settings (FILL-IN).
// Reads the connection string from local .env.local (git-blocked).
// Failures print short codes only — never the connection string.
// No local orders copied.
const fs = require('fs');
const path = require('path');
function getConnStr() {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '.env.local'),
  ];
  for (const p of candidates) {
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const m = txt.match(/^DATABASE_URL=(.+)$/m);
      if (m) return m[1].trim().replace(/^"|"$/g, '');
    } catch {}
  }
  return '';
}
function shortCode(e) {
  const c = e && (e.code || e.errno);
  return c ? String(c) : 'unknown';
}
(async () => {
  const conn = getConnStr();
  if (!conn) { console.error('FAIL: no DATABASE_URL in .env.local'); process.exit(1); }
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
    await sql`delete from variant_skus`;
    await sql`delete from addons`;
    await sql`delete from products`;
    await sql`delete from settings`;
    const [p] = await sql`insert into products (name, description, base_price, status, active) values ('Handbag','Lakky handbag',10000,'New',true) returning id`;
    const pid = p.id;
    const variants = [
      [{ colour: 'Black', size: '4"' }, 10000, 5],
      [{ colour: 'Black', size: '9"' }, 12000, 5],
      [{ colour: 'White', size: '4"' }, 10000, 2],
      [{ colour: 'White', size: '5"' }, 10000, 0],
    ];
    for (const [attrs, price, avail] of variants) {
      await sql`insert into variant_skus (product_id, attrs, price, available, reserved, active) values (${pid}, ${JSON.stringify(attrs)}::jsonb, ${price}, ${avail}, 0, true)`;
    }
    await sql`insert into addons (name, price, active) values ('Gift box', 2000, true)`;
    await sql`insert into settings (bank_details, global_daily_fee, free_hold_days, overpayment_threshold, underpayment_expiry_days, abandon_days, fulfilment_days, pickup_note) values (${JSON.stringify({ bank: 'FILL-IN', accountNumber: 'FILL-IN', accountName: 'Lakky Variety Store' })}::jsonb, 500, 14, 50000, 7, 60, ${JSON.stringify(['Mon','Thu','Sat'])}::jsonb, 'FILL-IN')`;
    const counts = await sql`select (select count(*)::int from products) as products, (select count(*)::int from variant_skus) as variants, (select count(*)::int from addons) as addons, (select count(*)::int from settings) as settings`;
    console.log('PASS: seeded pilot fresh: ' + JSON.stringify(counts[0]));
    await sql.end();
  } catch (e) { console.error('FAIL: seed failed, code=' + shortCode(e)); try { await sql.end(); } catch {} process.exit(1); }
})();
