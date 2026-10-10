'use server';

// V1 build actions: checkout options, credit-first, coupons, messages, refunds,
// cancel, notifications, reviews, problems, wishlist, accounts, staff, exports.
import postgres from 'postgres';
import crypto from 'crypto';

function conn() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('no-db');
  return postgres(url, { prepare: false });
}

const REFCHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeRef(): string {
  let s = 'REF-';
  const b = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += REFCHARS[b[i] % REFCHARS.length];
  return s;
}
function hashPw(pw: string, salt: string): string {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}

// ---- Reference ID: one short code per order, shown beside the account number ----
export async function ensureReference(args: { pendingRef: string }) {
  try {
    const sql = conn();
    const rows = await sql`select id, reference_id as "refId" from pending_refs where ref=${args.pendingRef} limit 1`;
    if (!rows.length) { await sql.end(); return { ok: false as const }; }
    if (rows[0].refId) { await sql.end(); return { ok: true as const, referenceId: rows[0].refId }; }
    for (let i = 0; i < 5; i++) {
      const code = makeRef();
      try {
        await sql`update pending_refs set reference_id=${code} where id=${rows[0].id} and reference_id is null`;
        await sql.end();
        return { ok: true as const, referenceId: code };
      } catch { /* collision: retry */ }
    }
    await sql.end();
    return { ok: false as const };
  } catch { return { ok: false as const }; }
}

// ---- admin: pending queue + search (Order ID, Reference ID, name, phone) ----
export async function listPending() {
  try {
    const sql = conn();
    const rows = await sql`select p.id, p.ref, p.reference_id as "referenceId", p.expected_total as total, p.status, p.created_at as "at", c.full_name as name, c.phone from pending_refs p left join customers c on c.id=p.customer_id where p.status in ('pending','under') order by p.id desc limit 200`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function adminSearch(args: { q: string }) {
  try {
    const sql = conn();
    const q = '%' + String(args.q || '').trim() + '%';
    const rows = await sql`select o.id, o.display_id as "displayId", o.total, o.paid_amount as paid, o.payment_status as pay, o.fulfilment_status as st, c.full_name as name, c.phone, (select reference_id from pending_refs p where p.id=o.pending_id) as "referenceId" from orders o left join customers c on c.id=o.customer_id where o.display_id ilike ${q} or c.full_name ilike ${q} or c.phone ilike ${q} or exists (select 1 from pending_refs p where p.id=o.pending_id and p.reference_id ilike ${q}) order by o.id desc limit 100`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}

// ---- admin: pending detail + reject / partial + fee marks + refunds ----
export async function getPendingDetail(args: { ref: string }) {
  try {
    const sql = conn();
    const all = await sql`select p.*, c.full_name as name, c.phone from pending_refs p left join customers c on c.id=p.customer_id limit 5000`;
    const pend = (all as any[]).find((r) => r.ref === args.ref || r.reference_id === args.ref);
    if (!pend) { await sql.end(); return { ok: false as const }; }
    const items = await sql`select * from pending_items where pending_id=${pend.id}`;
    const subs = await sql`select * from payment_submissions where pending_id=${pend.id} order by id`;
    await sql.end();
    return { ok: true as const, pending: pend, items, submissions: subs };
  } catch { return { ok: false as const }; }
}
const REJECT_OK = ['Underpayment', 'Fake receipt', 'Wrong order', 'Other'];
export async function rejectPending(args: { ref: string; reason: string; note?: string; admin?: string }) {
  try {
    const sql = conn();
    const reason = REJECT_OK.includes(args.reason) ? args.reason : 'Other';
    const all = await sql`select * from pending_refs where status in ('pending','under') limit 5000`;
    const pend = (all as any[]).find((r) => r.ref === args.ref || r.reference_id === args.ref);
    if (!pend) { await sql.end(); return { ok: false as const }; }
    await sql`update pending_refs set status='rejected' where id=${pend.id}`;
    await sql`insert into order_messages (order_id, sender, text) values (${pend.id}, 'owner', ${'Order not accepted: ' + reason + (args.note ? ' — ' + args.note : '')})`;
    await sql`insert into notifications (customer_id, order_id, type, message) values (${pend.customer_id}, null, 'rejected', ${'Order ' + pend.ref + ' was not accepted: ' + reason})`;
    await sql`insert into order_events (order_id, actor, action, note) values (null, ${args.admin || 'owner'}, 'pending-rejected', ${pend.ref + ': ' + reason})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function markPartial(args: { ref: string; note: string; admin?: string }) {
  try {
    const sql = conn();
    const all = await sql`select * from pending_refs where status in ('pending','under') limit 5000`;
    const pend = (all as any[]).find((r) => r.ref === args.ref || r.reference_id === args.ref);
    if (!pend) { await sql.end(); return { ok: false as const }; }
    await sql`update pending_refs set status='partial' where id=${pend.id}`;
    await sql`insert into order_messages (order_id, sender, text) values (${pend.id}, 'owner', ${'Partially accepted: ' + (args.note || '') + ' — reply: store credit, refund for missing items, or cancel all.'})`;
    await sql`insert into notifications (customer_id, order_id, type, message) values (${pend.customer_id}, null, 'partial', ${'Order ' + pend.ref + ' partially accepted — open it to choose.'})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function markFeePaid(args: { orderId: number; kind: string; admin?: string }) {
  try {
    const sql = conn();
    await sql`insert into fee_payments (order_id, amount, status, verified_by) values (${args.orderId}, 0, 'verified', ${args.admin || 'owner'})`;
    await sql`insert into order_messages (order_id, sender, text) values (${args.orderId}, 'owner', ${args.kind === 'delivery' ? 'Delivery fee marked paid.' : 'Stockpile fee marked paid.'})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function listFees(args: { orderId?: number }) {
  try {
    const sql = conn();
    const rows = args.orderId
      ? await sql`select * from fee_payments where order_id=${args.orderId} order by id desc`
      : await sql`select f.*, o.display_id as "displayId" from fee_payments f left join orders o on o.id=f.order_id order by f.id desc limit 200`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function listRefunds(args: { orderId?: number }) {  try {
    const sql = conn();
    const rows = args.orderId
      ? await sql`select * from refund_requests where order_id=${args.orderId} order by id desc`
      : await sql`select * from refund_requests where status='pending' order by id desc limit 100`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}

// ---- order thread: numeric order id + messages by pending ref or display id ----
export async function getOrderThread(args: { ref: string }) {
  try {
    const sql = conn();
    const key = String(args.ref || '').trim().toUpperCase();
    const all = await sql`select id, display_id as "displayId", pending_id as "pendingId" from orders order by id desc limit 5000`;
    const hit = (all as any[]).find((o) => String(o.displayId).toUpperCase() === key || String(o.displayId).toUpperCase().endsWith(key));
    let orderId: number | null = hit ? hit.id : null;
    if (!orderId) {
      const p = await sql`select id from pending_refs where ref=${args.ref} or reference_id=${args.ref} limit 1`;
      if (p.length) {
        const m = await sql`select id from orders where pending_id=${p[0].id} order by id desc limit 1`;
        if (m.length) orderId = m[0].id;
      }
    }
    const messages = orderId ? await sql`select sender, text, created_at as "at" from order_messages where order_id=${orderId} order by id` : [];
    await sql.end();
    return { ok: true as const, orderId, messages };
  } catch { return { ok: false as const, orderId: null, messages: [] as any[] }; }
}

// ---- credit-first quote: whole balance applied first, remainder to pay ----
export async function quoteWithCredit(args: { phone: string; total: number; coupon?: string }) {
  try {
    const sql = conn();
    const norm = String(args.phone || '').replace(/\D/g, '');
    const cust = await sql`select id, credit_balance as "creditBalance" from customers where replace(replace(replace(phone,'+',''),'-',''),' ','') like ${'%' + norm.slice(-10)} limit 1`;
    let credit = 0, cid: number | null = null;
    if (cust.length) { credit = Number(cust[0].creditBalance) || 0; cid = cust[0].id; }
    let total = args.total, couponOff = 0;
    if (args.coupon) {
      const cp = await sql`select * from coupons where code=${String(args.coupon).trim().toUpperCase()}`;
      if (cp.length) {
        const c = cp[0];
        const valid = (!c.expiry || new Date(c.expiry) > new Date()) && Number(c.used) < Number(c.usage_limit);
        if (valid) couponOff = Math.round((total * Number(c.percent)) / 100);
      }
    }
    total = Math.max(0, total - couponOff);
    const used = Math.min(credit, total);
    await sql.end();
    return { ok: true as const, credit, couponOff, used, toPay: Math.max(0, total - used), customerId: cid };
  } catch { return { ok: false as const }; }
}

// ---- order messages (simple per-order thread) ----
export async function postMessage(args: { orderId: number; sender: string; text: string }) {
  try {
    const sql = conn();
    const t = String(args.text || '').slice(0, 1000);
    if (!args.orderId || !t.trim()) { await sql.end(); return { ok: false as const }; }
    await sql`insert into order_messages (order_id, sender, text) values (${args.orderId}, ${args.sender}, ${t})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function getMessages(args: { orderId: number }) {
  try {
    const sql = conn();
    const rows = await sql`select sender, text, created_at as "at" from order_messages where order_id=${args.orderId} order by id`;
    await sql.end();
    return { ok: true as const, messages: rows };
  } catch { return { ok: false as const, messages: [] as any[] }; }
}

// ---- refund / credit / cashout / cancel-money requests ----
export async function requestMoney(args: { orderId?: number; phone: string; kind: string; amount?: number; bankName?: string; accountNumber?: string; accountName?: string }) {
  try {
    const sql = conn();
    const norm = String(args.phone || '').replace(/\D/g, '');
    const cust = await sql`select id from customers where phone like ${'%' + norm.slice(-4)} limit 50`;
    const me = cust.find((c: any) => String(c.phone || '').replace(/\D/g, '').endsWith(norm.slice(-4)));
    void me;
    const list = await sql`select id, phone from customers limit 5000`;
    const hit = (list as any[]).find((c) => String(c.phone).replace(/\D/g, '') === '+' + norm || String(c.phone).replace(/\D/g, '') === norm);
    if (!hit) { await sql.end(); return { ok: false as const }; }
    await sql`insert into refund_requests (order_id, customer_id, kind, amount, bank_name, account_number, account_name, status) values (${args.orderId || null}, ${hit.id}, ${args.kind}, ${args.amount || 0}, ${args.bankName || ''}, ${args.accountNumber || ''}, ${args.accountName || ''}, 'pending')`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function decideRefund(args: { id: number; approve: boolean; admin: string }) {
  try {
    const sql = conn();
    const rows = await sql`select * from refund_requests where id=${args.id}`;
    if (!rows.length || rows[0].status !== 'pending') { await sql.end(); return { ok: false as const }; }
    const r = rows[0];
    if (args.approve && (r.kind === 'credit' || r.kind === 'cancel-credit')) {
      await sql`update customers set credit_balance = coalesce(credit_balance,0) + ${Number(r.amount)} where id=${r.customer_id}`;
    }
    await sql`insert into order_events (order_id, actor, action, note) values (${r.order_id}, ${args.admin}, ${args.approve ? 'refund-approved' : 'refund-declined'}, ${r.kind})`;
    await sql`update refund_requests set status=${args.approve ? 'approved' : 'declined'} where id=${args.id}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- customer cancel (before confirm) / request (after) ----
export async function cancelOrder(args: { orderId: number; phone: string; reason: string; note?: string }) {
  try {
    const sql = conn();
    const o = await sql`select * from orders where id=${args.orderId}`;
    if (!o.length) { await sql.end(); return { ok: false as const }; }
    const st = String(o[0].fulfilment_status || '');
    if (['processing', 'pending'].includes(st)) {
      await sql`update orders set fulfilment_status='cancelled' where id=${args.orderId}`;
      await sql`insert into order_messages (order_id, sender, text) values (${args.orderId}, 'customer', ${'Cancelled: ' + args.reason + (args.note ? ' — ' + args.note : '')})`;
    } else {
      await sql`insert into order_messages (order_id, sender, text) values (${args.orderId}, 'customer', ${'Cancellation REQUESTED: ' + args.reason + (args.note ? ' — ' + args.note : '')})`;
      await sql`update orders set fulfilment_status='cancel-requested' where id=${args.orderId}`;
    }
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- fulfilment progress + who-completed + reminders due ----
const FLOW = ['pending', 'confirmed', 'packaged', 'onway', 'ready', 'completed'];
export async function setProgress(args: { ids: number[]; to: string; actor: string }) {
  try {
    const sql = conn();
    if (!FLOW.includes(args.to) || !args.ids.length) { await sql.end(); return { ok: false as const }; }
    for (const id of args.ids.slice(0, 100)) {
      await sql`update orders set fulfilment_status=${args.to} where id=${id}`;
      await sql`insert into order_events (order_id, actor, action) values (${id}, ${args.actor}, ${'status->' + args.to})`;
    }
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function remindersDue() {
  try {
    const sql = conn();
    const s = await sql`select free_hold_days as "free", reminder_first_days as first, reminder_every_days as every from settings limit 1`;
    const first = Number(s[0]?.first ?? 2), every = Number(s[0]?.every ?? 2);
    const rows = await sql`select id, display_id as "displayId", fulfilment_status as st, confirmed_at as "at" from orders where fulfilment_status in ('ready','onway')`;
    const now = Date.now();
    const due = (rows as any[]).filter((o) => {
      const days = Math.floor((now - new Date(o.at).getTime()) / 86400000);
      return days >= first && (days - first) % Math.max(1, every) === 0;
    });
    await sql.end();
    return { ok: true as const, due };
  } catch { return { ok: false as const, due: [] as any[] }; }
}

// ---- notifications: push event + prefs ----
export async function notify(args: { customerId?: number; orderId?: number; type: string; message: string }) {
  try {
    const sql = conn();
    if (args.customerId) {
      const off = await sql`select id from notification_prefs where customer_id=${args.customerId} and type=${args.type} and off=true limit 1`;
      if (off.length) { await sql.end(); return { ok: true as const, skipped: true }; }
    }
    await sql`insert into notifications (customer_id, order_id, type, message) values (${args.customerId || null}, ${args.orderId || null}, ${args.type}, ${args.message})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function setPref(args: { customerId: number; type: string; off: boolean }) {
  try {
    const sql = conn();
    await sql`delete from notification_prefs where customer_id=${args.customerId} and type=${args.type}`;
    if (args.off) await sql`insert into notification_prefs (customer_id, type, off) values (${args.customerId}, ${args.type}, true)`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- reviews (buyers only) + problem reports ----
export async function addReview(args: { productName: string; customerName: string; orderId: number; stars: number; note?: string }) {
  try {
    const sql = conn();
    const o = await sql`select id from orders where id=${args.orderId} and fulfilment_status='completed' limit 1`;
    if (!o.length) { await sql.end(); return { ok: false as const }; }
    await sql`insert into reviews (product_name, customer_name, order_id, stars, note) values (${args.productName}, ${args.customerName}, ${args.orderId}, ${Math.max(1, Math.min(5, args.stars))}, ${args.note || ''})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function reportProblem(args: { orderId: number; reason: string; photoKey?: string }) {
  try {
    const sql = conn();
    await sql`insert into problem_reports (order_id, reason, photo_url) values (${args.orderId}, ${args.reason}, ${args.photoKey || ''})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- wishlist ----
export async function toggleWish(args: { customerId: number; productName: string }) {
  try {
    const sql = conn();
    const ex = await sql`select id from wishlist where customer_id=${args.customerId} and product_name=${args.productName} limit 1`;
    if (ex.length) await sql`delete from wishlist where id=${ex[0].id}`;
    else await sql`insert into wishlist (customer_id, product_name) values (${args.customerId}, ${args.productName})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- customer accounts (email OTP later; owner resets in admin) ----
export async function signUpCustomer(args: { name: string; phone: string; email: string; password: string }) {
  try {
    const sql = conn();
    if (!args.name || !args.phone || !args.email || !args.password || args.password.length < 6) { await sql.end(); return { ok: false as const }; }
    const dup = await sql`select id from customers where email=${args.email} limit 1`;
    if (dup.length) { await sql.end(); return { ok: false as const, reason: 'email-used' }; }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = salt + ':' + hashPw(args.password, salt);
    const norm = String(args.phone).replace(/\D/g, '');
    const ph = '+' + norm;
    const rows = await sql`insert into customers (full_name, phone, email, password_hash, credit_balance) values (${args.name}, ${ph}, ${args.email}, ${hash}, 0) returning id`;
    const token = crypto.randomBytes(24).toString('hex');
    await sql`insert into customer_sessions (id, customer_id, expires_at) values (${token}, ${rows[0].id}, ${new Date(Date.now() + 30 * 86400000).toISOString()})`;
    await sql.end();
    return { ok: true as const, token, customerId: rows[0].id };
  } catch { return { ok: false as const }; }
}
export async function signInCustomer(args: { email: string; password: string }) {
  try {
    const sql = conn();
    const rows = await sql`select * from customers where email=${args.email} limit 1`;
    if (!rows.length || !rows[0].password_hash) { await sql.end(); return { ok: false as const }; }
    const [salt, h] = String(rows[0].password_hash).split(':');
    if (hashPw(args.password, salt) !== h) { await sql.end(); return { ok: false as const }; }
    const token = crypto.randomBytes(24).toString('hex');
    await sql`insert into customer_sessions (id, customer_id, expires_at) values (${token}, ${rows[0].id}, ${new Date(Date.now() + 30 * 86400000).toISOString()})`;
    await sql.end();
    return { ok: true as const, token, customerId: rows[0].id, name: rows[0].full_name };
  } catch { return { ok: false as const }; }
}
export async function resetCustomerPassword(args: { customerId: number; newPassword: string }) {
  try {
    const sql = conn();
    if (!args.newPassword || args.newPassword.length < 6) { await sql.end(); return { ok: false as const }; }
    const salt = crypto.randomBytes(16).toString('hex');
    await sql`update customers set password_hash=${salt + ':' + hashPw(args.newPassword, salt)} where id=${args.customerId}`;
    await sql`delete from customer_sessions where customer_id=${args.customerId}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- catalogue helpers: discounts, wholesale price, coupons, media ----
export function discountFor(p: any, now = new Date()) {
  if (!p || !p.discount_value) return null;
  if (p.discount_start && new Date(p.discount_start) > now) return null;
  if (p.discount_end && new Date(p.discount_end) < now) return null;
  return p;
}
export function tierPrice(tiers: any, qty: number, base: number): number {
  try {
    const list = (typeof tiers === 'string' ? JSON.parse(tiers) : tiers) || [];
    let price = base;
    for (const t of list) if (qty >= Number(t.min) && (t.max === undefined || qty <= Number(t.max))) price = Number(t.each);
    return price;
  } catch { return base; }
}

// ---- dashboard numbers + exports ----
export async function dashboard() {
  try {
    const sql = conn();
    const today = new Date().toISOString().slice(0, 10);
    const sales = await sql`select coalesce(sum(paid_amount),0)::int as s from orders where payment_status in ('confirmed','overpayment') and confirmed_at::date=${today}`;
    const open = await sql`select count(*)::int as n from orders where fulfilment_status not in ('completed','cancelled')`;
    const fees = await sql`select count(*)::int as n from orders where stockpile_status='held'`;
    const credit = await sql`select coalesce(sum(credit_balance),0)::int as s from customers`;
    const low = await sql`select p.name, v.attrs, v.available from variant_skus v join products p on p.id=v.product_id where v.available <= coalesce(p.low_stock_threshold, 1) order by v.available limit 50`;
    await sql.end();
    return { ok: true as const, salesToday: sales[0].s, openOrders: open[0].n, stockpiled: fees[0].n, creditOwed: credit[0].s, lowStock: low };
  } catch { return { ok: false as const }; }
}
export async function exportCsv(args: { what: string }) {
  try {
    const sql = conn();
    let rows: any[] = [];
    if (args.what === 'orders') rows = await sql`select o.display_id, o.total, o.paid_amount, o.payment_status, o.fulfilment_status, o.confirmed_at from orders o order by o.id limit 2000`;
    else rows = await sql`select full_name, phone, email, credit_balance from customers order by id limit 2000`;
    await sql.end();
    if (!rows.length) return { ok: true as const, csv: '' };
    const head = Object.keys(rows[0]).join(',');
    const body = rows.map((r) => Object.values(r).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return { ok: true as const, csv: head + '\n' + body + '\n' };
  } catch { return { ok: false as const, csv: '' }; }
}

// ---- activity log ----
export async function logEvent(args: { orderId?: number; actor: string; action: string; note?: string }) {
  try {
    const sql = conn();
    await sql`insert into order_events (order_id, actor, action, note) values (${args.orderId || null}, ${args.actor}, ${args.action}, ${args.note || ''})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
