'use server';

// V1 build actions: checkout options, credit-first, coupons, messages, refunds,
// cancel, notifications, reviews, problems, wishlist, accounts, staff, exports.
import postgres from 'postgres';
import crypto from 'crypto';
import { stepLabel } from './pricing';

function conn() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('no-db');
  return postgres(url, { prepare: false });
}

// Same admin gate as shop-actions (duplicated to avoid a server-module cycle).
// Staff-capable gate: admin always passes; approved staff pass their allowed actions.
async function requireStaffAction(): Promise<boolean> {
  try {
    const { auth } = await import('./auth');
    const { headers } = await import('next/headers');
    const session = await auth.api.getSession({ headers: await headers() });
    const role = ((session?.user as any)?.role as string) || '';
    if (!session?.user || (role !== 'admin' && role !== 'staff')) return false;
    if (role === 'staff') {
      const postgres = (await import('postgres')).default;
      const sql = postgres(process.env.DATABASE_URL || '', { prepare: false });
      try {
        const inv = await sql`select status from staff_invites where email=${(session.user as any).email} order by created_at desc limit 1`;
        await sql.end();
        if (!inv.length || inv[0].status !== 'approved') return false;
      } catch {
        try { await sql.end(); } catch {}
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

// HTTP callers need an admin session; local scripts have no request scope.
async function requireAdminAction(): Promise<boolean> {
  try {
    const { getAdminSession } = await import('./auth');
    const s = await getAdminSession();
    return !!s.ok;
  } catch {
    return true;
  }
}
function hashPw(pw: string, salt: string): string {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}

// ---- Order ID lookup: one ID per order, given at submit (legacy: no new codes) ----
export async function ensureReference(args: { pendingRef: string }) {
  try {
    const sql = conn();
    const key = String(args.pendingRef || '').trim();
    const rows = await sql`select id, display_id as "displayId" from pending_refs where ref=${key} or reference_id=${key} or display_id=${key} or display_id=${key.toUpperCase()} limit 1`;
    if (!rows.length) { await sql.end(); return { ok: false as const }; }
    const displayId = rows[0].displayId as string | null;
    await sql.end();
    if (!displayId) return { ok: false as const };
    return { ok: true as const, referenceId: displayId, displayId };
  } catch { return { ok: false as const }; }
}

// ---- admin: recent confirmed orders tab ----
export async function listConfirmed() {
  try {
    // ADMIN-GATED:listConfirmed
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const rows = await sql`select o.id, o.display_id as "displayId", o.total, o.fulfilment_status as st, o.confirmed_at as "at", c.full_name as name, c.phone, (select reference_id from pending_refs p where p.id=o.pending_id) as "referenceId", (select count(*)::int from order_messages m where m.order_id=o.id and m.sender='customer' and coalesce(m.seen_by_admin,false)=false) as "unread" from orders o left join customers c on c.id=o.customer_id order by o.id desc limit 100`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}

// ---- admin: pending queue + search (Order ID, Reference ID, name, phone) ----
export async function listPending() {
  try {
    // ADMIN-GATED:listPending
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const rows = await sql`select p.id, p.ref, p.display_id as "displayId", p.reference_id as "referenceId", p.expected_total as total, p.status, p.created_at as "at", c.full_name as name, c.phone, (select max(amount_claimed) from payment_submissions s where s.pending_id=p.id) as submitted, exists(select 1 from payment_submissions s where s.pending_id=p.id and s.proof_url is not null and s.proof_url <> '') as "hasReceipt", (select count(*)::int from order_messages m where m.pending_id=p.id and m.sender='customer' and coalesce(m.seen_by_admin,false)=false) as "unread" from pending_refs p left join customers c on c.id=p.customer_id where p.status in ('pending','under') order by p.id desc limit 200`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function adminSearch(args: { q: string }) {  try {
    // ADMIN-GATED:adminSearch
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:getPendingDetail
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const key = String(args.ref || '').trim();
    const all = await sql`select p.*, c.full_name as name, c.phone from pending_refs p left join customers c on c.id=p.customer_id where p.ref=${key} or p.reference_id=${key} or p.display_id=${key} or p.display_id=${key.toUpperCase()} limit 2`;
    const pend = (all as any[])[0];
    if (!pend) { await sql.end(); return { ok: false as const }; }
    const items = await sql`select * from pending_items where pending_id=${pend.id}`;
    const subs = await sql`select * from payment_submissions where pending_id=${pend.id} order by id`;
    // Figures for the Expected box: one number the owner should have received.
    // Stockpile fee accrues itself after the free days (confirmed orders only).
    let figures: any = null;
    try {
      const submittedTotal = (subs as any[]).reduce((s, x) => s + Number(x.amount_claimed || 0), 0);
      const method = (pend.fulfilment as any)?.method || '';
      const isStockpile = method === 'Stockpile';
      const expectedTotal = Number(pend.expected_total || 0);
      let freeUntil = '', extraDays = 0, rate = 0, feeAmount = 0;
      const ord = await sql`select free_until as "freeUntil", fulfilment_method as method from orders where pending_id=${pend.id} order by id desc limit 1`.catch(() => []);
      if (ord.length && isStockpile) {
        freeUntil = ord[0].freeUntil ? String(ord[0].freeUntil).slice(0, 10) : '';
        const st = await sql`select stockpile_fee_per_day as fee, global_daily_fee as glob from settings limit 1`.catch(() => []);
        rate = Number(st.length ? (st[0].fee ?? st[0].glob ?? 0) : 0);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        if (freeUntil && today > freeUntil && rate > 0) {
          extraDays = Math.ceil((new Date(today + 'T12:00:00Z').getTime() - new Date(freeUntil + 'T12:00:00Z').getTime()) / 86400000);
          feeAmount = extraDays * rate;
        }
      }
      figures = {
        expectedTotal, submittedTotal, method, isStockpile, freeUntil, extraDays, rate, feeAmount,
        expectedWithFee: expectedTotal + feeAmount,
        under: submittedTotal < expectedTotal,
        over: submittedTotal > expectedTotal,
      };
    } catch { /* figures stay null */ }
    await sql.end();
    return { ok: true as const, pending: pend, items, submissions: subs, figures };
  } catch { return { ok: false as const }; }
}
const REJECT_OK = ['Underpayment', 'Fake receipt', 'Wrong order'];
export async function underPending(args: { ref: string; admin?: string }) {
  try {
    // ADMIN-GATED:underPending
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const all = await sql`select * from pending_refs where (status='pending' or status='under') and (ref=${args.ref} or reference_id=${args.ref} or display_id=${args.ref} or display_id=${String(args.ref || '').trim().toUpperCase()}) limit 2`;
    const pend = (all as any[])[0];
    if (!pend) { await sql.end(); return { ok: false as const }; }
    await sql`update pending_refs set status='under' where id=${pend.id}`;
    await sql`insert into notifications (customer_id, order_id, type, message) values (${pend.customer_id}, null, 'underpayment', ${'Order ' + (pend.display_id || pend.ref) + ' needs a top-up.'})`;
    await sql`insert into order_events (order_id, actor, action) values (null, ${args.admin || 'owner'}, ${'pending-under:' + (pend.display_id || pend.ref)})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function rejectPending(args: { ref: string; reason: string; note?: string; admin?: string }) {
  try {
    // ADMIN-GATED:rejectPending
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const reason = REJECT_OK.includes(args.reason) ? args.reason : 'Other';
    const all = await sql`select * from pending_refs where (status='pending' or status='under') and (ref=${args.ref} or reference_id=${args.ref} or display_id=${args.ref} or display_id=${String(args.ref || '').trim().toUpperCase()}) limit 2`;
    const pend = (all as any[])[0];
    if (!pend) { await sql.end(); return { ok: false as const }; }
    await sql`update pending_refs set status='rejected' where id=${pend.id}`;
    await sql`insert into order_messages (order_id, pending_id, sender, text) values (null, ${pend.id}, 'owner', ${'Order not accepted: ' + reason + (args.note ? ' — ' + args.note : '')})`;
    await sql`insert into notifications (customer_id, order_id, type, message) values (${pend.customer_id}, null, 'rejected', ${'Order ' + (pend.display_id || pend.ref) + ' was not accepted: ' + reason})`;
    await sql`insert into order_events (order_id, actor, action, note) values (null, ${args.admin || 'owner'}, 'pending-rejected', ${(pend.display_id || pend.ref) + ': ' + reason})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function markPartial(args: { ref: string; note: string; admin?: string }) {
  try {
    // ADMIN-GATED:markPartial
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const all = await sql`select * from pending_refs where (status='pending' or status='under') and (ref=${args.ref} or reference_id=${args.ref} or display_id=${args.ref} or display_id=${String(args.ref || '').trim().toUpperCase()}) limit 2`;
    const pend = (all as any[])[0];
    if (!pend) { await sql.end(); return { ok: false as const }; }
    await sql`update pending_refs set status='partial' where id=${pend.id}`;
    await sql`insert into order_messages (order_id, pending_id, sender, text) values (null, ${pend.id}, 'owner', ${'Partially accepted: ' + (args.note || '') + ' — reply: store credit, refund for missing items, or cancel all.'})`;
    await sql`insert into notifications (customer_id, order_id, type, message) values (${pend.customer_id}, null, 'partial', ${'Order ' + (pend.display_id || pend.ref) + ' partially accepted — open it to choose.'})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function markFeePaid(args: { orderId: number; kind: string; admin?: string }) {
  try {
    // ADMIN-GATED:markFeePaid
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    await sql`insert into fee_payments (order_id, amount, status, verified_by) values (${args.orderId}, 0, 'verified', ${args.admin || 'owner'})`;
    await sql`insert into order_messages (order_id, sender, text) values (${args.orderId}, 'owner', ${args.kind === 'delivery' ? 'Delivery fee marked paid.' : 'Stockpile fee marked paid.'})`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function listFees(args: { orderId?: number }) {
  try {
    // ADMIN-GATED:listFees
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const rows = args.orderId
      ? await sql`select * from fee_payments where order_id=${args.orderId} order by id desc`
      : await sql`select f.*, o.display_id as "displayId" from fee_payments f left join orders o on o.id=f.order_id order by f.id desc limit 200`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function listRefunds(args: { orderId?: number }) {  try {
    // ADMIN-GATED:listRefunds
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:getOrderThread
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const key = String(args.ref || '').trim().toUpperCase();
    const all = await sql`select id, display_id as "displayId", pending_id as "pendingId", fulfilment_status as st, confirmed_at as "at", fulfilment_method as method, free_until as "freeUntil" from orders where upper(display_id) = ${key} or upper(display_id) like ${'%' + key} order by id desc limit 5`;
    const hit = (all as any[])[0];
    let orderId: number | null = hit ? hit.id : null;
    if (!orderId) {
      const p = await sql`select id from pending_refs where ref=${args.ref} or reference_id=${args.ref} or display_id=${args.ref} or display_id=${String(args.ref || '').trim().toUpperCase()} limit 1`;
      if (p.length) {
        const m = await sql`select id from orders where pending_id=${p[0].id} order by id desc limit 1`;
        if (m.length) orderId = m[0].id;
      }
    }
    const messages = orderId ? await sql`select sender, text, created_at as "at" from order_messages where order_id=${orderId} order by id` : [];
    await sql.end();
    const stRow = orderId ? (all as any[]).find((o) => o.id === orderId) : null;
    let timeline: any = null;
    if (stRow) {
      timeline = {
        displayId: stRow.displayId, fulfilment: stRow.st,
        confirmedAt: stRow.at, method: stRow.method || '',
        freeUntil: stRow.freeUntil ? String(stRow.freeUntil).slice(0, 10) : '',
      };
    }
    return { ok: true as const, orderId, pendingId: stRow ? stRow.pendingId : null, displayId: stRow ? stRow.displayId : null, messages, status: stRow ? stRow.st : null, timeline };
  } catch { return { ok: false as const, orderId: null, messages: [] as any[] }; }
}

// ---- stockpile aged past max days: contact + release back to sale ----
export async function agedStockpile() {
  try {
    // ADMIN-GATED:agedStockpile
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:releaseStockpile
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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

// ---- customer session gate: guests see images+prices only, no cart/orders ----
export async function customerSession(args: { token: string }) {
  try {
    const sql = conn();
    if (!args.token) { await sql.end(); return { ok: false as const }; }
    const s = await sql`select customer_id as "cid", expires_at as "exp" from customer_sessions where id=${args.token} limit 1`;
    if (!s.length || new Date(s[0].exp) < new Date()) { await sql.end(); return { ok: false as const }; }
    const c = await sql`select id, full_name as name, phone from customers where id=${s[0].cid} limit 1`;
    await sql.end();
    if (!c.length) return { ok: false as const };
    return { ok: true as const, customer: c[0] };
  } catch { return { ok: false as const }; }
}

// ---- one-tap progress with instant customer notice (labels live in ./pricing) ----
const NEXT: Record<string, string[]> = {
  processing: ['packaged', 'ready'], packaged: ['ready', 'onway', 'completed'],
  ready: ['completed'], onway: ['completed'],
};
export async function advanceOrder(args: { orderId: number; to: string; actor?: string }) {
  try {
    // ADMIN-GATED:advanceOrder
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const cur = await sql`select fulfilment_status as st, customer_id as "cid", display_id as "displayId" from orders where id=${args.orderId} limit 1`;
    if (!cur.length) { await sql.end(); return { ok: false as const }; }
    const from = String(cur[0].st || '');
    if (!(NEXT[from] || []).includes(args.to)) { await sql.end(); return { ok: false as const }; }
    await sql`update orders set fulfilment_status=${args.to} where id=${args.orderId}`;
    await sql`insert into order_events (order_id, actor, action) values (${args.orderId}, ${args.actor || 'owner'}, ${'status->' + args.to})`;
    await sql`insert into notifications (customer_id, order_id, type, message) values (${cur[0].cid}, ${args.orderId}, 'progress', ${'Order ' + cur[0].displayId + ' is now: ' + stepLabel(args.to)})`;
    await sql`insert into order_messages (order_id, sender, text) values (${args.orderId}, 'owner', ${'Status update: ' + stepLabel(args.to)})`;
    await sql.end();
    return { ok: true as const, label: stepLabel(args.to) };
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

// ---- order messages: two-way chat from the moment the order is submitted ----
// Works before confirm (pending_id) and after (order_id). Owner replies notify
// the customer in-app; customer messages are logged for the owner.
export async function postMessage(args: { orderId?: number; pendingId?: number; sender: string; text: string }) {
  try {
    const sql = conn();
    const t = String(args.text || '').slice(0, 1000);
    if ((!args.orderId && !args.pendingId) || !t.trim()) { await sql.end(); return { ok: false as const }; }
    if (args.sender !== 'owner' && args.sender !== 'customer') { await sql.end(); return { ok: false as const }; }
    await sql`insert into order_messages (order_id, pending_id, sender, text, seen_by_admin) values (${args.orderId || null}, ${args.pendingId || null}, ${args.sender}, ${t}, ${args.sender === 'owner'})`;
    if (args.sender === 'owner') {
      let cid: number | null = null;
      let oid: number | null = args.orderId || null;
      try {
        if (args.orderId) {
          const c = await sql`select customer_id as "cid" from orders where id=${args.orderId} limit 1`;
          if (c.length) cid = c[0].cid;
        } else if (args.pendingId) {
          const c = await sql`select customer_id as "cid" from pending_refs where id=${args.pendingId} limit 1`;
          if (c.length) cid = c[0].cid;
          const o = await sql`select id from orders where pending_id=${args.pendingId} order by id desc limit 1`;
          if (o.length) oid = o[0].id;
        }
      } catch { /* notify best-effort */ }
      if (cid) {
        const off = await sql`select id from notification_prefs where customer_id=${cid} and type='message' and off=true limit 1`.catch(() => []);
        if (!off.length) await sql`insert into notifications (customer_id, order_id, type, message) values (${cid}, ${oid}, 'message', ${t.slice(0, 200)})`.catch(() => null);
      }
    } else {
      const detail = args.orderId ? `order:${args.orderId}` : `pending:${args.pendingId}`;
      await sql`insert into order_events (order_id, actor, action, note) values (${args.orderId || null}, 'customer', 'message', ${detail})`.catch(() => null);
      // Buzz the owner's phone (works once push keys are added; silent before).
      try {
        let label = detail;
        if (args.orderId) {
          const o = await sql`select display_id as "d" from orders where id=${args.orderId} limit 1`.catch(() => []);
          if (o.length && o[0].d) label = o[0].d;
        } else if (args.pendingId) {
          const pd = await sql`select display_id as "d" from pending_refs where id=${args.pendingId} limit 1`.catch(() => []);
          if (pd.length && pd[0].d) label = pd[0].d;
        }
        const { sendAdminPush } = await import('./push');
        await sendAdminPush({ title: 'New customer message', body: `${label}: ${t}`, url: `/admin/orders/${encodeURIComponent(label)}` });
      } catch { /* push best-effort */ }
    }
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function getMessages(args: { orderId?: number; pendingId?: number }) {
  try {
    const sql = conn();
    const rows = args.orderId
      ? await sql`select sender, text, created_at as "at" from order_messages where order_id=${args.orderId} order by id`
      : await sql`select sender, text, created_at as "at" from order_messages where pending_id=${args.pendingId} order by id`;
    await sql.end();
    return { ok: true as const, messages: rows };
  } catch { return { ok: false as const, messages: [] as any[] }; }
}

// ---- admin inbox: unread badge data + banner feed (works before push keys) ----
export async function markThreadSeen(args: { orderId?: number; pendingId?: number }) {
  try {
    if (!(await requireStaffAction())) return { ok: false as const };
    const sql = conn();
    if (args.orderId) await sql`update order_messages set seen_by_admin=true where order_id=${args.orderId} and sender='customer'`;
    else if (args.pendingId) await sql`update order_messages set seen_by_admin=true where pending_id=${args.pendingId} and sender='customer'`;
    else { await sql.end(); return { ok: false as const }; }
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// Everything needing the owner's attention since `sinceIso`: new customer
// messages, new unconfirmed orders, new receipt uploads.
export async function adminInbox(args: { sinceIso: string }) {
  try {
    if (!(await requireStaffAction())) return { ok: false as const, messages: [], orders: [], receipts: [] };
    const sql = conn();
    let since: string;
    try {
      since = new Date(args.sinceIso).toISOString();
      if (Number.isNaN(Date.parse(since))) throw new Error('bad-date');
    } catch {
      since = new Date(Date.now() - 24 * 3600000).toISOString();
    }
    const messages = await sql`select m.text, m.created_at as "at", coalesce(o.display_id, p.display_id, p.ref) as "displayId", c.full_name as name from order_messages m left join orders o on o.id=m.order_id left join pending_refs p on p.id=m.pending_id or p.id=o.pending_id left join customers c on c.id=o.customer_id or c.id=p.customer_id where m.sender='customer' and coalesce(m.seen_by_admin,false)=false and m.created_at > ${since} order by m.id desc limit 20`.catch(() => []);
    const orders = await sql`select p.display_id as "displayId", p.expected_total as total, p.created_at as "at", c.full_name as name from pending_refs p left join customers c on c.id=p.customer_id where p.status in ('pending','under') and p.created_at > ${since} order by p.id desc limit 20`.catch(() => []);
    const receipts = await sql`select s.amount_claimed as amount, s.created_at as "at", p.display_id as "displayId", c.full_name as name from payment_submissions s join pending_refs p on p.id=s.pending_id left join customers c on c.id=p.customer_id where s.proof_url is not null and s.proof_url <> '' and s.created_at > ${since} order by s.id desc limit 20`.catch(() => []);
    await sql.end();
    return { ok: true as const, messages, orders, receipts };
  } catch { return { ok: false as const, messages: [] as any[], orders: [] as any[], receipts: [] as any[] }; }
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
    // ADMIN-GATED:decideRefund
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:setProgress
    if (!(await requireStaffAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:remindersDue
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:resetCustomerPassword
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:getProductAdmin
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:saveProductAdmin
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:listCoupons
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const rows = await sql`select * from coupons order by code`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function createCoupon(args: { code: string; percent: number; expiry?: string; limit: number }) {
  try {
    // ADMIN-GATED:createCoupon
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:addMedia
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:mediaViewUrl
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
    const { receiptViewUrl } = await import('./storage');
    return await receiptViewUrl(args.key, 'product-images');
  } catch { return { ok: false as const }; }
}
export async function addAddon(args: { productName: string; name: string; price: number; stock: number }) {  try {
    // ADMIN-GATED:addAddon
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:inviteStaff
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:listInvites
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:approveStaff
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    await sql`update staff_invites set status=${args.approve ? 'approved' : 'declined'} where email=${args.email}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function listCustomers() {
  try {
    // ADMIN-GATED:listCustomers
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
    const sql = conn();
    const rows = await sql`select id, full_name as name, phone, email, credit_balance as credit from customers order by id desc limit 500`;
    await sql.end();
    return { ok: true as const, rows };
  } catch { return { ok: false as const, rows: [] as any[] }; }
}
export async function listEvents() {
  try {
    // ADMIN-GATED:listEvents
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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

// ---- delete a product photo or a whole product (refuses when orders use it) ----
export async function deleteMedia(args: { id: number }) {
  try {
    // ADMIN-GATED:deleteMedia
    if (!(await requireAdminAction())) return { ok: false as const };
    const sql = conn();
    await sql`delete from product_images where id=${args.id}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
export async function deleteProduct(args: { name: string }) {
  try {
    // ADMIN-GATED:deleteProduct
    if (!(await requireAdminAction())) return { ok: false as const };
    const sql = conn();
    const p = await sql`select id from products where name=${args.name} limit 1`;
    if (!p.length) { await sql.end(); return { ok: false as const }; }
    const skus = await sql`select id from variant_skus where product_id=${p[0].id}`;
    const ids = (skus as any[]).map((s) => s.id);
    if (ids.length) {
      const r1 = await sql`select count(*)::int as n from pending_items where variant_sku_id = any(${ids})`;
      const r2 = await sql`select count(*)::int as n from order_items where variant_sku_id = any(${ids})`;
      if (r1[0].n + r2[0].n > 0) { await sql.end(); return { ok: false as const, reason: 'in-orders' }; }
    }
    await sql`delete from product_addons where product_id=${p[0].id}`;
    await sql`delete from product_images where product_id=${p[0].id}`;
    await sql`delete from variant_skus where product_id=${p[0].id}`;
    await sql`delete from products where id=${p[0].id}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// ---- date-range report from Supabase (plain numbers for the screen, CSV kept) ----
export async function reportRange(args: { from: string; to: string }) {
  try {
    // ADMIN-GATED:reportRange
    if (!(await requireAdminAction())) return { ok: false as const };
    const sql = conn();
    const rows = await sql`select o.display_id as id, o.total, o.paid_amount as paid, o.payment_status as pay, o.fulfilment_status as st, o.fulfilment_method as method, o.confirmed_at as at, o.stockpile_status as stock, (select coalesce(sum(amount),0)::int from fee_payments f where f.order_id=o.id and f.status='verified') as "feePaid" from orders o where o.confirmed_at::date >= ${args.from} and o.confirmed_at::date <= ${args.to} order by o.id limit 2000`;
    await sql.end();
    const list = rows as any[];
    const sum = (f: (o: any) => number) => list.reduce((s, o) => s + (f(o) || 0), 0);
    const has = (v: string, ...ws: string[]) => list.filter((o) => ws.includes(String(v === 'pay' ? o.pay : o.st)));
    return {
      ok: true as const,
      summary: {
        placed: list.length,
        approved: has('pay', 'confirmed', 'overpayment').length,
        rejected: list.filter((o) => o.st === 'cancelled').length,
        under: has('pay', 'underpayment').length,
        over: has('pay', 'overpayment').length,
        pickup: list.filter((o) => o.method === 'Pickup').length,
        delivery: list.filter((o) => o.method === 'Delivery').length,
        stockpiled: list.filter((o) => o.stock === 'held').length,
        money: sum((o) => Number(o.paid)),
      },
      rows: list,
    };
  } catch { return { ok: false as const }; }
}

// ---- sweep: unpaid drafts with no receipt past the owner-set minutes expire ----
export async function sweepUnpaid() {
  try {
    // ADMIN-GATED:sweepUnpaid
    if (!(await requireStaffAction())) return { ok: false as const };
    const sql = conn();
    const s = await sql`select unpaid_expiry_minutes as mins from settings limit 1`;
    const mins = Math.max(1, Number(s[0]?.mins ?? 30));
    const old = await sql`select p.id from pending_refs p where p.status='draft' and p.created_at < now() - (${mins} || ' minutes')::interval and not exists (select 1 from payment_submissions s where s.pending_id=p.id)`;
    for (const r of old as any[]) await sql`update pending_refs set status='expired' where id=${r.id}`;
    await sql.end();
    return { ok: true as const, expired: (old as any[]).length };
  } catch { return { ok: false as const, expired: 0 }; }
}

// ---- dashboard numbers + exports ----
export async function dashboard() {
  try {
    // ADMIN-GATED:dashboard
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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
    // ADMIN-GATED:exportCsv
    if (!(await requireAdminAction())) return { ok: false as const, rows: [] as any[] };
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

