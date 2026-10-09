// Syncs db/seed.ts catalogue into Supabase (idempotent: match by name + attrs JSON).
// Prints counts only, never secrets.
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
    const { pathToFileURL } = require('url');
    const seed = await import(pathToFileURL('C:\\Users\\lakky\\Documents\\Default Project\\Lakky-variety-store-project\\db\\seed.ts').href);
    let pc = 0, vc = 0;
    for (const p of seed.seedProducts) {
      let prow = await sql`select id from products where name=${p.name}`;
      let pid;
      if (!prow.length) {
        const ins = await sql`insert into products (name, description, base_price, status, active) values (${p.name}, ${p.description || ''}, ${p.basePrice}, ${p.status || ''}, true) returning id`;
        pid = ins[0].id; pc++;
      } else pid = prow[0].id;
      for (const v of p.variants) {
        const attrs = JSON.stringify(v.attrs);
        const ex = await sql`select id from variant_skus where product_id=${pid} and attrs=${attrs}::jsonb`;
        if (!ex.length) {
          await sql`insert into variant_skus (product_id, attrs, price, available, reserved, active) values (${pid}, ${attrs}::jsonb, ${v.price}, ${v.available}, 0, true)`;
          vc++;
        }
      }
    }
    for (const a of seed.seedAddons) {
      const ex = await sql`select id from addons where name=${a.name}`;
      if (!ex.length) await sql`insert into addons (name, price, active) values (${a.name}, ${a.price}, true)`;
    }
    const tot = await sql`select (select count(*)::int from products) as products, (select count(*)::int from variant_skus) as variants`;
    console.log('PASS: synced new-products=' + pc + ' new-variants=' + vc + ' totals=' + JSON.stringify(tot[0]));
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
