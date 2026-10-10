'use server';

// V1 build actions: checkout options, credit-first, coupons, messages, refunds,
// cancel, notifications, reviews, problems, wishlist, accounts, staff, exports.
import postgres from 'postgres';
import crypto from 'crypto';
import { makeRef } from './pricing';

function conn() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('no-db');
  return postgres(url, { prepare: false });
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

// ---- stockpile aged past max days: contact + release back to sale ----
export async function agedStockpile() {
  try {
    const sql = conn();
    const s = await sql`select max_stockpile_days as maxd from settings limit 1`;
    const maxd = Number(s[0]?.maxd ?? 60);
    const rows = await sql`select o.id, o.display_id as "displayId", o.confirmed_at as "at", c.full_name as name from orders o left join customers c on c.id=o.customer_id where o.stockpile_status='held' and o.fulfilment_status not in ('completed','cancelled')`;
    const now = Date.now();
    const aged = (rows as any[]).filter((o) => Math.floor((now - new Date(o.at).getTime()) / 86400000) > maxd)
      .map((o) => ({ ...o, days: Math.floor((now - new Date(o.at).getTime()) / 86400000), maxd }));
    await sql.end();
    return { ok: true as const, aged };
  } catch { return { ok: false as const, aged: [] as any[] }; }
}
export async function releaseStockpile(args: { orderId: number; actor?: string }) {
  try {
    const sql = conn();
    const items = await sql`select variant_sku_id as "sku", qty from order_items where order_id=${args.orderId}`;
    for (const it of items as any[]) {
      if (it.sku) await sql`update variant_skus set reserved = reserved - ${it.qty}, available = available + ${it.qty} where id=${it.sku}`;
    }
    await sql`update orders set stockpile_status='released', fulfilment_status='cancelled' where id=${args.orderId}`;
    await sql`insert into order_messages (order_id, sender, text) values (${args.orderId}, 'owner', 'Order left uncollected past max days, returned to stock. Contact admin for details.')`;
    await sql`insert into order_events (order_id, actor, action) values (${args.orderId}, ${args.actor || 'owner'}, 'stockpile-released')`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
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

// ---- catalogue helpers live in ./pricing (plain module, no "use server") ----

// ---- admin catalogue: edit product, coupons, media ----
export async function getProductAdmin(args: { name: string }) {
  try {
    const sql = conn();
    const p = await sql`select * from products where name=${args.name} limit 1`;
    if (!p.length) { await sql.end(); return { ok: false as const }; }
    const variants = await sql`select * from variant_skus where product_id=${p[0].id} order by id`;
    const paddons = await sql`select * from product_addons where product_id=${p[0].id} order by id`;
    const media = await sql`select * from product_images where product_id=${p[0].id} order by sort limit 4`;
    await sql.end();
    return { ok: true as const, product: p[0], variants, addons: paddons, media };
  } catch { return { ok: false as const }; }
}
export async function saveProductAdmin(args: { name: string; patch: any; variants?: any[] }) {
  try {
    const sql = conn();
    const p = await sql`select id from products where name=${args.name} limit 1`;
    if (!p.length) { await sql.end(); return { ok: false as const }; }
    const id = p[0].id;
    const allowed = ['base_price', 'status', 'active', 'fee_override', 'low_stock_threshold', 'wholesale_tiers', 'discount_type', 'discount_value', 'discount_start', 'discount_end', 'new_tag_days'] as const;
    for (const k of allowed) {
      const v = (args.patch || {})[k];
      if (v !== undefined) await sql.unsafe(`update products set ${k} = $1 where id = $2`, [k === 'wholesale_tiers' && typeof v !== 'string' ? JSON.stringify(v) : v, id]);
    }
    if (args.patch?.markRestocked) await sql`update products set restocked_at = now(), status='Restocked' where id=${id}`;
    for (const v of args.variants || []) {
      await sql`update variant_skus set price=${v.price}, available=${v.available}, active=${v.active !== false} where id=${v.id} and product_id=${id}`;
    }
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function listCoupons() {
  try {
    const sql = conn();
    const rows = await sql`select * from coupons order by code`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function createCoupon(args: { code: string; percent: number; expiry?: string; limit: number }) {
  try {
    const sql = conn();
    const code = String(args.code || '').trim().toUpperCase();
    if (!code || !args.percent || !args.limit) { await sql.end(); return { ok: false as const }; }
    await sql`insert into coupons (code, percent, expiry, usage_limit, used) values (${code}, ${args.percent}, ${args.expiry || null}, ${args.limit}, 0) on conflict (code) do nothing`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function listDiscounted() {
  try {
    const sql = conn();
    const rows = await sql`select * from products where discount_value is not null and (discount_start is null or discount_start <= now()) and (discount_end is null or discount_end >= now()) and active != false order by name limit 200`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function getMedia(args: { productId?: number; productName?: string }) {
  try {
    const sql = conn();
    let pid = args.productId;
    if (!pid && args.productName) {
      const p = await sql`select id from products where name=${args.productName} limit 1`;
      if (p.length) pid = p[0].id;
    }
    if (!pid) { await sql.end(); return { ok: true as const, rows: [] as any[] }; }
    const rows = await sql`select * from product_images where product_id=${pid} order by sort limit 4`;
    await sql.end();
    const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const withUrls = (rows as any[]).map((m) => ({
      ...m,
      url: String(m.url).startsWith('http') ? m.url : `${base}/storage/v1/object/public/product-images/${m.url}`,
    }));
    return { ok: true as const, rows: withUrls };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
// ---- per-product add-ons (own price + stock; global gift box is the fallback) ----
export async function listAddons(args: { productName: string }) {
  try {
    const sql = conn();
    const p = await sql`select id from products where name=${args.productName} limit 1`;
    if (!p.length) { await sql.end(); return { ok: true as const, rows: [] as any[] }; }
    const rows = await sql`select * from product_addons where product_id=${p[0].id} and active != false order by id`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}

// ---- product media upload (owner phone; photos + ≤20MB video, view-only links) ----
export async function addMedia(args: { productName: string; fileBase64: string; contentType: string; ext: string; kind: string }) {
  try {
    if (Buffer.from(args.fileBase64, 'base64').length > 20 * 1024 * 1024) return { ok: false as const };
    const sql = conn();
    const p = await sql`select id from products where name=${args.productName} limit 1`;
    if (!p.length) { await sql.end(); return { ok: false as const }; }
    const n = await sql`select count(*)::int as n from product_images where product_id=${p[0].id}`;
    if (n[0].n >= 4) { await sql.end(); return { ok: false as const }; }
    const { uploadReceipt } = await import('./storage');
    const up = await uploadReceipt(Buffer.from(args.fileBase64, 'base64'), args.contentType, args.ext);
    if (!up.ok || !up.key) { await sql.end(); return { ok: false as const }; }
    await sql`insert into product_images (product_id, url, sort) values (${p[0].id}, ${up.key}, ${n[0].n})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function mediaViewUrl(args: { key: string }) {
  try {
    const { receiptViewUrl } = await import('./storage');
    return await receiptViewUrl(args.key, 'product-images');
  } catch { return { ok: false as const }; }
}
export async function addAddon(args: { productName: string; name: string; price: number; stock: number }) {
  try {
    const sql = conn();
    const p = await sql`select id from products where name=${args.productName} limit 1`;
    if (!p.length || !args.name) { await sql.end(); return { ok: false as const }; }
    await sql`insert into product_addons (product_id, name, price, stock, active) values (${p[0].id}, ${args.name}, ${args.price}, ${args.stock}, true)`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- staff invites + approval + customer password reset (owner) ----
export async function inviteStaff(args: { email: string }) {
  try {
    const sql = conn();
    const email = String(args.email || '').trim().toLowerCase();
    if (!email.includes('@')) { await sql.end(); return { ok: false as const }; }
    const id = crypto.randomBytes(12).toString('hex');
    await sql`insert into staff_invites (id, email, status) values (${id}, ${email}, 'pending') on conflict (id) do nothing`;
    await sql.end();
    return { ok: true as const, inviteId: id };
  } catch { return { ok: false as const }; }
}
export async function listInvites() {
  try {
    const sql = conn();
    const rows = await sql`select * from staff_invites order by created_at desc limit 100`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function joinStaff(args: { inviteId: string; password: string }) {
  try {
    const sql = conn();
    const inv = await sql`select * from staff_invites where id=${args.inviteId} and status='pending' limit 1`;
    if (!inv.length || !args.password || args.password.length < 6) { await sql.end(); return { ok: false as const }; }
    const { auth } = await import('./auth');
    await auth.api.signUpEmail({ body: { email: inv[0].email, password: args.password, name: 'Staff' } });
    await sql`update "user" set role='staff' where email=${inv[0].email}`;
    await sql`update staff_invites set status='joined' where id=${args.inviteId}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function approveStaff(args: { email: string; approve: boolean }) {
  try {
    const sql = conn();
    await sql`update staff_invites set status=${args.approve ? 'approved' : 'declined'} where email=${args.email}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function listCustomers() {
  try {
    const sql = conn();
    const rows = await sql`select id, full_name as name, phone, email, credit_balance as credit from customers order by id desc limit 500`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function listEvents() {
  try {
    const sql = conn();
    const rows = await sql`select order_id as "orderId", actor, action, note, created_at as "at" from order_events order by id desc limit 100`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function logShopEvent(args: { customerId?: number; kind: string; detail?: string }) {
  try {
    const sql = conn();
    await sql`insert into shop_events (customer_id, kind, detail) values (${args.customerId || null}, ${args.kind}, ${(args.detail || '').slice(0, 300)})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
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
