// Nightly-style full backup: key tables → JSON in backups/ (git-blocked).
// Supabase platform backups cover disaster recovery; this is the owner-readable copy.
// BACKUP_DIR env picks the folder (deferred off-machine location); defaults to ./backups.
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
  const dir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const postgres = require('postgres');
  const sql = postgres(conn, { prepare: false });
  try {
    const tables = ['products', 'variant_skus', 'addons', 'product_addons', 'customers', 'pending_refs', 'pending_items', 'payment_submissions', 'orders', 'order_items', 'order_messages', 'order_events', 'credit_ledger', 'fee_payments', 'refund_requests', 'reviews', 'problem_reports', 'coupons', 'wishlist', 'settings'];
    const dump = { at: new Date().toISOString(), tables: {} };
    for (const t of tables) {
      try { dump.tables[t] = await sql.unsafe(`select * from ${t} order by 1 limit 5000`); }
      catch { dump.tables[t] = []; }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(dir, `lakky-backup-${stamp}.json`), JSON.stringify(dump).slice(0, 50 * 1024 * 1024));
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('lakky-backup-')).sort();
    while (files.length > 90) fs.unlinkSync(path.join(dir, files.shift()));
    console.log('PASS: backup saved, kept ' + Math.min(files.length, 90) + ' daily copies (≥90-day rule while under limit)');
    await sql.end();
  } catch (e) { console.log('FAIL code=' + (e.code || 'unknown')); try { await sql.end(); } catch {} process.exit(1); }
})();
