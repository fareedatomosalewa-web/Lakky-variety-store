'use server';

import { db } from './db';
import { normalizePhone, last4 } from './phone';
import { customers, pendingRefs, pendingItems, paymentSubmissions, orders, orderItems, variantSkus, addons, settings } from '../db/schema';
import { eq, or, sql as dsql } from 'drizzle-orm';

// v1.7 Supabase slice: shop data lives in Supabase. Every action returns
// { ok } or { ok:false } so pages can fall back to the local demo flow.
// Secrets stay server-side — never returned to the browser.

// Admin gate: HTTP callers must hold an admin session. Local scripts have no
// request scope (headers() throws) — they already hold the database itself,
// so only HTTP callers without a session are refused.
async function requireAdminAction(): Promise<boolean> {
  try {
    const { getAdminSession } = await import('./auth');
    const s = await getAdminSession();
    return !!s.ok;
  } catch {
    return true;
  }
}

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

// ---- 1. Settings (bank, days, note, fees) ----
export async function getSettings() {
  try {
    const rows = await db.select().from(settings).limit(1);
    if (!rows.length) return { ok: false as const };
    const s = rows[0] as any;
    return {
      ok: true as const,
      settings: {
        bankDetails: s.bankDetails, globalDailyFee: s.globalDailyFee, freeHoldDays: s.freeHoldDays,
        overpaymentThreshold: s.overpaymentThreshold, underpaymentExpiryDays: s.underpaymentExpiryDays,
        abandonDays: s.abandonDays, fulfilmentDays: s.fulfilmentDays, pickupNote: s.pickupNote,
        stockpileFeePerDay: s.stockpileFeePerDay ?? 50, maxStockpileDays: s.maxStockpileDays ?? 60,
        creditCashMinimum: s.creditCashMinimum ?? 5000, restockTagDays: s.restockTagDays ?? 2,
        newTagDays: s.newTagDays ?? 7, reportWindowHours: s.reportWindowHours ?? 48,
        reminderFirstDays: s.reminderFirstDays ?? 2, reminderEveryDays: s.reminderEveryDays ?? 2,
        pickupLocation: s.pickupLocation || '', pickupReveal: !!s.pickupReveal,
        shopHours: s.shopHours || '', announcementOn: !!s.announcementOn,
        announcementText: s.announcementText || '', socialLinks: s.socialLinks || [],
        aboutText: s.aboutText || '', helpText: s.helpText || '',
      },
    };
  } catch { return { ok: false as const }; }
}

export async function saveSettings(patch: Record<string, unknown>) {
  try {
    if (!(await requireAdminAction())) return { ok: false as const, reason: 'admin-only' };
    const allowed = ['bankDetails', 'globalDailyFee', 'freeHoldDays', 'overpaymentThreshold', 'underpaymentExpiryDays', 'abandonDays', 'fulfilmentDays', 'pickupNote', 'stockpileFeePerDay', 'maxStockpileDays', 'creditCashMinimum', 'restockTagDays', 'newTagDays', 'reportWindowHours', 'reminderFirstDays', 'reminderEveryDays', 'pickupLocation', 'pickupReveal', 'shopHours', 'announcementOn', 'announcementText', 'socialLinks', 'aboutText', 'helpText'] as const;
    const clean: Record<string, unknown> = {};
    for (const k of allowed) if (patch[k] !== undefined) clean[k] = patch[k];
    if (!Object.keys(clean).length) return { ok: false as const };
    const rows = await db.select({ id: settings.id }).from(settings).limit(1);
    if (!rows.length) return { ok: false as const };
    await db.update(settings).set(clean as any).where(eq(settings.id, rows[0].id));
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

export type CartLine = { attrs?: Record<string, string>; price: number; qty: number; addon?: { name: string; price: number } | null };

// ---- 2. Checkout creates the pending order in Supabase ----
async function resolveVariantSkuId(attrs: Record<string, string> | undefined, price: number): Promise<number | null> {
  const skus = await db.select().from(variantSkus);
  const norm = JSON.stringify(attrs || {});
  const hit = (skus as any[]).find((v) => JSON.stringify(v.attrs) === norm && v.price === price)
    || (skus as any[]).find((v) => v.price === price);
  return hit ? hit.id : null;
}

export async function createPending(args: {
  name: string; phone: string; method: string; area: string; day: string;
  agreedAt: string; lines: CartLine[]; total: number; creditApplied?: number; couponCode?: string; token?: string;
}) {
  try {
    if (args.token) {
      const { customerSession } = await import('./shop-v1');
      const s: any = await customerSession({ token: args.token });
      if (!s.ok) return { ok: false as const, reason: 'login-required' };
    } else {
      return { ok: false as const, reason: 'login-required' };
    }
    const phone = normalizePhone(args.phone);
    const cust = await db.insert(customers).values({ fullName: args.name, phone } as any)
      .onConflictDoUpdate({ target: customers.phone, set: { fullName: args.name } })
      .returning({ id: customers.id });
    const customerId = (cust as any[])[0].id;
    const refYear = new Date().getFullYear();
    const seq = await db.execute(dsql`select nextval('pending_ref_seq') as n`);
    const n = Number((seq as any).rows ? (seq as any).rows[0].n : (seq as any)[0].n);
    const ref = `P-${refYear}-${String(n).padStart(4, '0')}`;
    const { makeRef } = await import('./pricing');
    let referenceId: string | null = null;
    for (let i = 0; i < 5 && !referenceId; i++) {
      const code = makeRef();
      try {
        const chk: any = await db.execute(dsql`select id from pending_refs where reference_id = ${code} limit 1`);
        const rows = chk.rows || chk;
        if (!rows.length) referenceId = code;
      } catch { /* retry */ }
    }
    // Server-side totals: browser prices are display-only. Re-price every line
    // from the database, apply a valid coupon first, then all store credit.
    let gross = 0;
    for (const l of args.lines) {
      const skuId = await resolveVariantSkuId(l.attrs, l.price);
      let unit = l.price;
      if (skuId) {
        const r: any = await db.execute(dsql`select price from variant_skus where id = ${skuId} limit 1`);
        const rows = r.rows || r;
        if (rows.length) unit = Number(rows[0].price);
      }
      gross += unit * l.qty;
      if (l.addon) {
        let ap = l.addon.price;
        try {
          const pa: any = await db.execute(dsql`select price from product_addons where name = ${l.addon!.name} limit 1`);
          const pr = pa.rows || pa;
          if (pr.length) ap = Number(pr[0].price);
          else {
            const ad = await db.select().from(addons);
            const hit = (ad as any[]).find((a) => a.name === l.addon!.name);
            if (hit) ap = hit.price;
          }
        } catch { /* browser price stands */ }
        gross += ap * l.qty;
      }
    }
    let couponCode: string | null = null;
    if (args.couponCode) {
      try {
        const cp: any = await db.execute(dsql`select percent, expiry, usage_limit, used from coupons where code = ${String(args.couponCode).trim().toUpperCase()} limit 1`);
        const rows = cp.rows || cp;
        if (rows.length) {
          const c = rows[0];
          if ((!c.expiry || new Date(c.expiry) > new Date()) && Number(c.used) < Number(c.usage_limit)) {
            gross = Math.max(0, gross - Math.round((gross * Number(c.percent)) / 100));
            couponCode = String(args.couponCode).trim().toUpperCase();
          }
        }
      } catch { /* no coupon */ }
    }
    const bal: any = await db.execute(dsql`select coalesce(credit_balance,0) as b from customers where id = ${customerId} limit 1`);
    const balRows = bal.rows || bal;
    const serverUsed = Math.min(balRows.length ? Number(balRows[0].b) : 0, gross);
    const serverTotal = Math.max(0, gross - serverUsed);
    const prow = await db.insert(pendingRefs).values({
      ref, referenceId, customerId,
      fulfilment: { method: args.method, area: args.area, day: args.day },
      expectedTotal: serverTotal, creditApplied: serverUsed, couponCode: couponCode || null,
      status: 'pending', agreedAt: args.agreedAt ? new Date(args.agreedAt) : null,
    } as any).returning({ id: pendingRefs.id });
    const pendingId = (prow as any[])[0].id;
    for (const l of args.lines) {
      const skuId = await resolveVariantSkuId(l.attrs, l.price);
      const skuRows: any = skuId ? await db.execute(dsql`select price from variant_skus where id = ${skuId} limit 1`) : null;
      const skuList = skuRows ? (skuRows.rows || skuRows) : [];
      const unit = skuList.length ? Number(skuList[0].price) : l.price;
      await db.insert(pendingItems).values({ pendingId, variantSkuId: skuId, qty: l.qty, unitPriceSnapshot: unit } as any);
      if (l.addon) {
        const ad = await db.select().from(addons);
        const hit = (ad as any[]).find((a) => a.name === l.addon!.name) || null;
        const pa: any = await db.execute(dsql`select id, price from product_addons where name = ${l.addon!.name} limit 1`).catch(() => null);
        const paRows = pa ? (pa.rows || pa) : [];
        const addonPrice = paRows.length ? Number(paRows[0].price) : (hit ? hit.price : l.addon.price);
        await db.insert(pendingItems).values({ pendingId, addonId: hit ? hit.id : null, qty: l.qty, unitPriceSnapshot: addonPrice } as any);
      }
    }
    return { ok: true as const, ref, pendingId, total: serverTotal, creditUsed: serverUsed };
  } catch { return { ok: false as const }; }
}

export async function recordPayment(args: { ref: string; amount: number; date: string; time?: string; reference?: string }) {  try {
    const p = await db.select().from(pendingRefs).where(or(eq(pendingRefs.ref, args.ref), eq(pendingRefs.referenceId, args.ref))).limit(2);
    const hit = (p as any[])[0];
    if (!hit) return { ok: false as const };
    await db.insert(paymentSubmissions).values({
      pendingId: hit.id, amountClaimed: args.amount,
      transferDate: args.date || null, transferTime: args.time || null,
      reference: args.reference || null, status: 'pending',
    } as any);
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

function lagosToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---- 3. Admin Confirm in ONE transaction: order + items + stock move ----
export async function confirmOrder(args: { pendingRef: string; verifiedAmount: number; seenBank: boolean }) {
  try {
    if (!(await requireStaffAction())) return { ok: false as const, reason: 'admin-only' };
    if (!args.seenBank) return { ok: false as const, reason: 'seen-bank-required' };
    const all = await db.select().from(pendingRefs).where(or(eq(pendingRefs.ref, args.pendingRef), eq(pendingRefs.referenceId, args.pendingRef))).limit(2);
    const pend = (all as any[])[0];
    if (!pend || pend.status !== 'pending') return { ok: false as const, reason: 'not-pending' };
    const items = (await db.select().from(pendingItems).where(eq(pendingItems.pendingId, pend.id))) as any[];
    const subs = (await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.pendingId, pend.id))) as any[];
    const paid = subs.length ? subs[subs.length - 1].amountClaimed : args.verifiedAmount;
    const expected = pend.expectedTotal;
    if (args.verifiedAmount < expected) {
      await db.update(pendingRefs).set({ status: 'under' } as any).where(eq(pendingRefs.id, pend.id));
      return { ok: false as const, reason: 'underpayment', outstanding: expected - args.verifiedAmount };
    }
    const cust = (await db.select().from(customers).where(eq(customers.id, pend.customerId)).limit(2)) as any[];
    const phone = cust.length ? cust[0].phone : '';
    const l4 = last4(phone);
    const sets = await db.select().from(settings).limit(1);
    const freeDays = (sets[0] as any)?.freeHoldDays ?? 14;
    const today = lagosToday();
    return await db.transaction(async (tx: any) => {
      const serialRes: any = await tx.execute(dsql`select nextval('order_serial_seq') as n`);
      const serial = Number(serialRes.rows ? serialRes.rows[0].n : serialRes[0].n);
      const displayId = `LVS-${String(serial).padStart(3, '0')}-${l4}`;
      const skuLines = items.filter((i) => i.variantSkuId);
      for (const line of skuLines) {
        const upd: any = await tx.execute(dsql`update variant_skus set available = available - ${line.qty}, reserved = reserved + ${line.qty} where id = ${line.variantSkuId} and available >= ${line.qty}`);
        const moved = upd.count ?? upd.rowCount ?? 0;
        if (!moved) throw new Error('race-lost');
      }
      const orow: any[] = await tx.insert(orders).values({
        orderNumber: serial, displayId, customerId: pend.customerId, pendingId: pend.id,
        total: expected, paidAmount: paid, paymentStatus: paid > expected ? 'overpayment' : 'confirmed',
        fulfilmentMethod: (pend.fulfilment as any)?.method || null, fulfilmentDetails: pend.fulfilment,
        fulfilmentStatus: 'processing', confirmedAt: new Date(), freeUntil: addDays(today, freeDays),
        stockpileStatus: 'held', agreedAt: pend.agreedAt, seenInBank: true, last4: l4,
      } as any).returning({ id: orders.id });
      const orderId = orow[0].id;
      for (const line of items) {
        await tx.insert(orderItems).values({
          orderId, variantSkuId: line.variantSkuId, addonId: line.addonId,
          qty: line.qty, unitPriceSnapshot: line.unitPriceSnapshot,
        } as any);
      }
            await tx.update(pendingRefs).set({ status: 'confirmed' } as any).where(eq(pendingRefs.id, pend.id));
      const over = paid > expected ? paid - expected : 0;      if (over > 0) {
        await tx.execute(dsql`insert into credit_ledger (customer_id, order_id, amount, reason) values (${pend.customerId}, ${orderId}, ${over}, 'overpayment auto-credit')`);
        await tx.execute(dsql`update customers set credit_balance = coalesce(credit_balance,0) + ${over} where id = ${pend.customerId}`);
      }
      if (pend.couponCode) {
        await tx.execute(dsql`update coupons set used = used + 1 where code = ${pend.couponCode}`);
      }
      await tx.execute(dsql`insert into notifications (customer_id, order_id, type, message) values (${pend.customerId}, ${orderId}, 'confirmed', ${'Order ' + displayId + ' confirmed.'})`);
      await tx.execute(dsql`insert into order_messages (order_id, sender, text) values (${orderId}, 'owner', 'Payment confirmed. Order is being prepared.')`);
      return { ok: true as const, displayId, over };
    });
  } catch (e: any) {
    if (String(e?.message).includes('race-lost')) return { ok: false as const, reason: 'race-lost' };
    return { ok: false as const, reason: 'error' };
  }
}

// ---- 4. Track: Order ID + FULL phone, or pending Reference ID + FULL phone ----
export async function trackOrder(args: { displayId: string; phone: string }) {
  try {
    const id = String(args.displayId || '').trim().toUpperCase();
    const phone = normalizePhone(args.phone);
    if (!id || !phone) return { ok: false as const };
    const found = await db.select().from(orders).where(or(eq(orders.displayId, id), eq(orders.displayId, String(args.displayId || '').trim()))).limit(2);
    const order = (found as any[])[0];
    if (order) {
      const cust = ((await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(2)) as any[]);
      if (!cust.length || normalizePhone(cust[0].phone) !== phone) return { ok: false as const };    const sets = await db.select().from(settings).limit(1);
      const rate = (sets[0] as any)?.globalDailyFee ?? 500;
      const today = lagosToday();
      const freeUntil = String(order.freeUntil || '').slice(0, 10);
      const extraDays = freeUntil && today > freeUntil
        ? Math.ceil((new Date(today + 'T12:00:00Z').getTime() - new Date(freeUntil + 'T12:00:00Z').getTime()) / 86400000)
        : 0;
      return {
        ok: true as const,
        order: {
          id: order.id, displayId: order.displayId, status: order.paymentStatus, fulfilment: order.fulfilmentStatus,
          total: order.total, paid: order.paidAmount,
          confirmedAt: order.confirmedAt, freeUntil, extraDays, fee: extraDays * rate, rate,
        },
      };
    }
    // Pending stage: reference code + phone sees where the payment stands
    const pend = (await db.select().from(pendingRefs).where(or(eq(pendingRefs.ref, String(args.displayId || '').trim()), eq(pendingRefs.referenceId, String(args.displayId || '').trim()))).limit(2)) as any[];
    const p = pend[0];
    if (!p) return { ok: false as const };
    const cust = ((await db.select().from(customers).where(eq(customers.id, p.customerId)).limit(2)) as any[]);
    if (!cust.length || normalizePhone(cust[0].phone) !== phone) return { ok: false as const };
    const stage = p.status === 'confirmed' ? 'confirmed' : p.status === 'under' ? 'underpayment' : p.status === 'rejected' ? 'rejected' : 'checking';
    return { ok: true as const, pending: true as const, stage, ref: p.referenceId || p.ref, total: p.expectedTotal, status: p.status };
  } catch { return { ok: false as const }; }
}

// ---- Receipt upload: bytes go to private Supabase Storage, key saved on the submission ----
export async function submitReceipt(args: { ref: string; amount: number; fileBase64: string | null; contentType: string; ext: string; bankRef?: string }) {
  try {
    const all = (await db.select().from(pendingRefs).where(or(eq(pendingRefs.ref, args.ref), eq(pendingRefs.referenceId, args.ref))).limit(2)) as any[];
    const pend = all[0];
    if (!pend) return { ok: false as const, reason: 'not-found' };
    let key: string | null = null;
    if (args.fileBase64) {
      const { uploadReceipt } = await import('./storage');
      const up = await uploadReceipt(Buffer.from(args.fileBase64, 'base64'), args.contentType || 'image/jpeg', args.ext || 'jpg');
      if (!up.ok || !up.key) return { ok: false as const, reason: 'upload-failed' };
      key = up.key;
    } else if (args.amount > 0) {
      return { ok: false as const, reason: 'receipt-required' };
    }
    await db.insert(paymentSubmissions).values({
      pendingId: pend.id, amountClaimed: args.amount,
      transferDate: lagosToday(), proofUrl: key, reference: args.bankRef || null, status: 'pending',
    } as any);
    await db.update(pendingRefs).set({ agreedAt: new Date() } as any).where(eq(pendingRefs.id, pend.id));
    return { ok: true as const, key };
  } catch { return { ok: false as const, reason: 'error' }; }
}

// ---- Admin: short-lived signed link to view a receipt (never public) ----
export async function getReceiptUrl(args: { key: string }) {
  try {
    if (!(await requireStaffAction())) return { ok: false as const };
    if (!args.key) return { ok: false as const };
    const { receiptViewUrl } = await import('./storage');
    return await receiptViewUrl(args.key);
  } catch { return { ok: false as const }; }
}

// ---- Admin: latest receipt for a pending ref (image + verified box stay together) ----
export async function getSubmissionProof(args: { ref: string }) {
  try {
    if (!(await requireStaffAction())) return { ok: false as const };
    const all = (await db.select().from(pendingRefs).where(or(eq(pendingRefs.ref, args.ref), eq(pendingRefs.referenceId, args.ref))).limit(2)) as any[];
    const pend = all[0];
    if (!pend) return { ok: false as const };
    const subs = ((await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.pendingId, pend.id))) as any[]);
    if (!subs.length) return { ok: false as const };
    const last = subs[subs.length - 1];
    if (!last.proofUrl) return { ok: true as const, amount: last.amountClaimed, url: null };
    const { receiptViewUrl } = await import('./storage');
    const v = await receiptViewUrl(last.proofUrl);
    return { ok: true as const, amount: last.amountClaimed, url: v.ok ? v.url : null, key: last.proofUrl };
  } catch { return { ok: false as const }; }
}
