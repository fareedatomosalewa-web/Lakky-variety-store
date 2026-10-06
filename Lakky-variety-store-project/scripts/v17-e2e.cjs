// v1.7 e2e: drives the REAL server actions (createPending → recordPayment →
// confirmOrder → trackOrder) against Supabase, then cleans up + restores stock.
// Prints PASS/FAIL lines only, never secrets.
const fs = require('fs');
const path = require('path');
function loadEnv() {
  for (const p of [path.join(process.cwd(), '.env.local'), path.join(__dirname, '..', '.env.local')]) {
    try {
      const t = fs.readFileSync(p, 'utf8');
      const m = t.match(/^DATABASE_URL=(.+)$/m);
      if (m) {
        process.env.DATABASE_URL = m[1].trim().replace(/^"|"$/g, '');
        for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BETTER_AUTH_SECRET']) {
          const km = t.match(new RegExp('^' + k + '=(.+)$', 'm'));
          if (km && !process.env[k]) process.env[k] = km[1].trim().replace(/^"|"$/g, '');
        }
        return true;
      }
    } catch {}
  }
  return false;
}
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; throw new Error('stop'); } console.log('PASS:', m); };
(async () => {
  if (!loadEnv()) { console.error('FAIL: no connection string'); process.exit(1); }
  const actions = await import('../lib/shop-actions.ts');
  const phone = '+234809991234';
  const stamp = Date.now().toString(36);

  // 2. Checkout creates pending
  const pend = await actions.createPending({
    name: 'E2E Buyer ' + stamp, phone, method: 'Pickup', area: '', day: '',
    agreedAt: new Date().toISOString(),
    lines: [{ attrs: { colour: 'Black', size: '9"' }, price: 12000, qty: 1 }],
    total: 12000,
  });
  assert(pend.ok && pend.ref.startsWith('P-'), 'e2e: checkout created pending ' + (pend.ref || 'none') + ' in Supabase');

  // Pay via receipt upload to the REAL private bucket (1px test image)
  const tinyJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////2wBDAf//////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AK//9k=';
  const pay = await actions.submitReceipt({ ref: pend.ref, amount: 12000, fileBase64: tinyJpegBase64, contentType: 'image/jpeg', ext: 'jpg' });
  assert(pay.ok && !!pay.key, 'e2e: receipt saved to private bucket, key on submission');
  const proof = await actions.getSubmissionProof({ ref: pend.ref });
  assert(proof.ok && !!proof.url, 'e2e: admin gets signed receipt link');

  // Stock before
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const before = await sql`select id, available, reserved from variant_skus where price=12000 limit 1`;

  // 3. Admin confirm (seen-in-bank) in one transaction
  const conf = await actions.confirmOrder({ pendingRef: pend.ref, verifiedAmount: 12000, seenBank: true });
  assert(conf.ok, 'e2e: admin confirm inserted order ' + (conf.displayId || 'none') + ' + moved stock');
  const after = await sql`select available, reserved from variant_skus where id=${before[0].id}`;
  assert(after[0].available === before[0].available - 1 && after[0].reserved === before[0].reserved + 1, 'e2e: stock moved available-=1 reserved+=1');

  // 4. Track reads it back
  const tr = await actions.trackOrder({ displayId: conf.displayId, phone });
  assert(tr.ok && tr.order.displayId === conf.displayId, 'e2e: track by ID+phone reads the Supabase row');
  const trWrong = await actions.trackOrder({ displayId: conf.displayId, phone: '+234800000000' });
  assert(!trWrong.ok, 'e2e: wrong phone retrieves nothing');

  // Cleanup: restore stock, remove test rows (keep sequences)
  const ord = await sql`select id from orders where display_id=${conf.displayId}`;
  if (ord.length) {
    await sql`delete from order_items where order_id=${ord[0].id}`;
    await sql`delete from orders where id=${ord[0].id}`;
  }
  await sql`update variant_skus set available = available + 1, reserved = reserved - 1 where id=${before[0].id}`;
  const restored = await sql`select available, reserved from variant_skus where id=${before[0].id}`;
  assert(restored[0].available === before[0].available && restored[0].reserved === before[0].reserved, 'e2e: stock restored, test rows removed');
  const subs = await sql`select id, pending_id, proof_url as "proofUrl" from payment_submissions where pending_id=${pend.pendingId}`;
  for (const s of subs) {
    if (s.proofUrl) { try { await sql`delete from storage.objects where bucket_id='payment-proofs' and name=${s.proofUrl}`; } catch {} }
    await sql`delete from payment_submissions where id=${s.id}`;
    await sql`delete from pending_items where pending_id=${s.pending_id}`;
    await sql`delete from pending_refs where id=${s.pending_id}`;
  }
  await sql`delete from customers where phone=${phone}`;
  await sql.end();
  console.log('ALL V1.7 E2E CHECKS PASSED');
})().catch((e) => { if (!process.exitCode) console.error('FAIL code=' + (e.code || 'unknown')); process.exit(1); });
