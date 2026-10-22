// v2 fix checks: drives the REAL server actions against Supabase and verifies
// the 7 reported problem areas at the data/action level. Creates only clearly
// named temp rows and removes them in `finally`. Never prints secrets.
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
    } catch { /* try next */ }
  }
  return false;
}
let fails = 0;
const ok = (c, m) => { if (c) console.log('PASS:', m); else { fails++; console.log('FAIL:', m); } };
(async () => {
  if (!loadEnv()) { console.error('FAIL: no connection string'); process.exit(1); }
  const actions = await import('../lib/shop-actions.ts');
  const v1 = await import('../lib/shop-v1.ts');
  const storage = await import('../lib/storage.ts');
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const stamp = Date.now().toString(36);
  const emailA = `v2fix-${stamp}@example.com`;
  const emailB = `v2fix-b-${stamp}@example.com`;
  const phoneA = '+23481' + String(Date.now()).slice(-8);
  const phoneB = '+23482' + String(Date.now()).slice(-8);
  let customerA = 0; let customerB = 0; let fakePending = 0;
  try {
    // ---- 1. Receipt preview (broken admin images) --------------------------
    const proofRow = await sql`select p.display_id as "displayId", s.proof_url as key from payment_submissions s join pending_refs p on p.id=s.pending_id where s.proof_url is not null and s.proof_url <> '' order by s.id desc limit 1`;
    if (proofRow.length) {
      const key = proofRow[0].key;
      const legacy = await storage.receiptViewUrl('/uploads/old-receipt.jpg');
      ok(legacy.ok === false && legacy.legacy === true, 'old /uploads receipt reports as legacy (no broken image shown)');
      const fresh = await actions.getSubmissionProof({ ref: proofRow[0].displayId });
      ok(fresh.ok && !!fresh.url && !fresh.legacy, 'admin receipt link created for stored Supabase key');
      ok(String(fresh.url || '').includes('/storage/v1/object/sign/'), 'receipt link now uses the /storage/v1 signed path');
      const head = await fetch(fresh.url, { method: 'GET' });
      ok(head.status === 200, 'receipt URL opens with HTTP 200 (was 404 before fix)');
      ok(String(head.headers.get('content-type') || '').startsWith('image/'), 'receipt URL returns an image');
      ok(String(key).includes('.jpg') || String(key).includes('.png'), 'old receipt file is still in storage (not lost)');
    } else ok(false, 'no stored receipt found to test');

    // ---- 2. Admin search by ID, name, phone -------------------------------
    customerA = (await v1.signUpCustomer({ name: 'V2 Fix Buyer ' + stamp, phone: phoneA, email: emailA, password: 'V2fix-pass-' + stamp })).customerId;
    const pendIns = await sql`insert into pending_refs (ref, display_id, customer_id, expected_total, status, fulfilment) values (${'P-V2-' + stamp.toUpperCase()}, ${'LVS-V2-' + stamp.toUpperCase()}, ${customerA}, 2500, 'pending', ${sql.json({ method: 'Pickup' })}) returning id`;
    fakePending = pendIns[0].id;
    const display = 'LVS-V2-' + stamp.toUpperCase();
    const byId = await v1.adminSearch({ q: display });
    ok(byId.ok && byId.rows.some((r) => r.displayId === display), 'admin search by Order ID returns the order');
    const byName = await v1.adminSearch({ q: 'V2 Fix Buyer ' + stamp });
    ok(byName.ok && byName.rows.some((r) => r.displayId === display), 'admin search by customer name returns the order');
    const byPhone = await v1.adminSearch({ q: phoneA });
    ok(byPhone.ok && byPhone.rows.some((r) => r.displayId === display), 'admin search by phone returns the order');
    const shortNum = await v1.adminSearch({ q: '20' });
    ok(shortNum.ok && Array.isArray(shortNum.rows), 'short number does not error (phone-mode only for real numbers)');

    // ---- 3. Reports consistency ------------------------------------------
    const from = new Date(Date.now() - 3650 * 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const rep = await v1.reportRange({ from, to });
    const paidSum = (rep.rows || []).filter((r) => r.kind === 'order').reduce((s, r) => s + Number(r.paid || 0), 0);
    ok(rep.ok && rep.summary.money === paidSum, 'Reports "money received" equals sum of paid amounts in the list');
    ok((rep.rows || []).every((r) => r.kind !== 'order' || r.id), 'every report line has an Order ID to click');
    const week = await sql`select coalesce(sum(total),0)::int as expected, coalesce(sum(paid_amount),0)::int as received from orders where confirmed_at > now() - interval '7 days'`;
    console.log(`INFO: last 7 days — expected ₦${week[0].expected.toLocaleString()} vs received ₦${week[0].received.toLocaleString()} (Orders card now shows received).`);

    // ---- 4. Notifications both ways --------------------------------------
    await v1.postMessage({ pendingId: fakePending, sender: 'owner', text: 'V2 test reply from shop' });
    const inbox = await v1.customerInbox({ token: (await v1.signInCustomer({ email: emailA, password: 'V2fix-pass-' + stamp })).token, sinceIso: new Date(Date.now() - 5 * 60000).toISOString() });
    ok(inbox.ok && inbox.messages.some((m) => String(m.text).includes('V2 test reply from shop')), 'customer receives shop reply in their inbox feed');
    const adm = await v1.adminInbox({ sinceIso: new Date(Date.now() - 5 * 60000).toISOString() }).catch(() => null);
    ok(!!adm && adm.ok && Array.isArray(adm.messages), 'admin inbox feed responds (drives the admin pop-up)');
    await v1.markThreadSeen({ pendingId: fakePending });

    // ---- 5. Signup / login / reset --------------------------------------
    const dupEmail = await v1.signUpCustomer({ name: 'Dup E', phone: phoneB, email: emailA.toUpperCase(), password: 'whatever1' });
    ok(!dupEmail.ok && dupEmail.reason === 'email-used', 'signup with an existing email is refused with a clear reason');
    const dupPhone = await v1.signUpCustomer({ name: 'Dup P', phone: phoneA.replace('+234', '0'), email: emailB, password: 'whatever1' });
    ok(!dupPhone.ok && dupPhone.reason === 'phone-used', 'signup with an existing phone is refused with a clear reason');
    const noAcct = await v1.signInCustomer({ email: `nobody-${stamp}@example.com`, password: 'x' });
    ok(!noAcct.ok && noAcct.reason === 'no-account', 'login on unknown email says no account exists');
    const wrongPw = await v1.signInCustomer({ email: emailA, password: 'definitely-wrong' });
    ok(!wrongPw.ok && wrongPw.reason === 'wrong-password', 'login with wrong password says the password is wrong');
    const legacyAcct = await sql`select email from customers where coalesce(password_hash,'')='' and coalesce(email,'')<>'' limit 1`;
    if (legacyAcct.length) {
      const noPw = await v1.signInCustomer({ email: legacyAcct[0].email, password: 'anything' });
      ok(!noPw.ok && noPw.reason === 'no-password', 'legacy account with no password gets the reset guidance');
    } else console.log('INFO: no legacy passwordless account left to test');
    const reset = await v1.resetPasswordByContact({ email: emailA, phone: phoneA, newPassword: 'V2fix-new-' + stamp });
    ok(reset.ok, 'forgot-password works with matching email + phone');
    const loginNew = await v1.signInCustomer({ email: emailA, password: 'V2fix-new-' + stamp });
    ok(loginNew.ok, 'login works with the newly set password');
    const resetBad = await v1.resetPasswordByContact({ email: emailA, phone: phoneB, newPassword: 'whatever1' });
    ok(!resetBad.ok && resetBad.reason === 'no-match', 'forgot-password refuses when the phone does not match');

    // ---- 6. Admin edits customer contact ---------------------------------
    customerB = (await v1.signUpCustomer({ name: 'V2 Fix Buyer B ' + stamp, phone: phoneB, email: emailB, password: 'V2fix-b-' + stamp })).customerId;
    const clashE = await v1.updateCustomerContact({ customerId: customerB, email: emailA, phone: phoneB });
    ok(!clashE.ok && clashE.reason === 'email-used', 'admin contact edit blocks a duplicate email (' + (clashE.reason || 'saved!') + ')');
    const clashP = await v1.updateCustomerContact({ customerId: customerB, email: emailB, phone: phoneA });
    ok(!clashP.ok && clashP.reason === 'phone-used', 'admin contact edit blocks a duplicate phone (' + (clashP.reason || 'saved!') + ')');
    const okEdit = await v1.updateCustomerContact({ customerId: customerB, email: `v2fixed-${stamp}@example.com`, phone: phoneB });
    ok(okEdit.ok, 'admin contact edit saves unique email + phone (' + (okEdit.reason || 'ok') + ')');

    // ---- 7. Settings + indexes -------------------------------------------
    const settings = await actions.getSettings();
    ok(settings.ok && typeof settings.settings.whatsappNumber === 'string', 'settings expose the WhatsApp number field');
    const idx = await sql`select indexname from pg_indexes where indexname in ('customers_email_lower_uniq','customers_phone_digits_uniq')`;
    ok(idx.length === 2, 'database enforces unique emails and phones');
    const completedCol = await sql`select 1 from information_schema.columns where table_name='orders' and column_name='completed_at' limit 1`;
    ok(completedCol.length === 1, 'orders have completed_at for the completed-state screen / report window');
  } catch (e) {
    fails++; console.log('FAIL: unexpected error —', String(e && e.message || e).slice(0, 160));
  } finally {
    try {
      if (fakePending) { await sql`delete from order_messages where pending_id=${fakePending}`; await sql`delete from pending_refs where id=${fakePending}`; }
      for (const id of [customerA, customerB]) {
        if (!id) continue;
        await sql`delete from notifications where customer_id=${id}`;
        await sql`delete from customer_sessions where customer_id=${id}`;
        await sql`delete from order_messages where order_id in (select id from orders where customer_id=${id})`;
        await sql`delete from customers where id=${id}`;
      }
      await sql.end();
      console.log('CLEANUP: temp rows removed (no real order or customer touched).');
    } catch (e) { console.log('CLEANUP WARN:', String(e && e.message || e).slice(0, 120)); }
    console.log(fails ? `RESULT: ${fails} check(s) failed` : 'RESULT: all checks passed');
    process.exit(fails ? 1 : 0);
  }
})();
