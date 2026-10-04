export function calcFee(confirmedAt: Date, today: Date, globalDailyFee: number, overrideRate: number | null): { extraDays: number; fee: number } {
  const day = 24 * 60 * 60 * 1000;
  const c = new Date(confirmedAt); c.setHours(0, 0, 0, 0);
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  const freeUntil = new Date(c.getTime() + 14 * day);
  const extraDays = Math.max(0, Math.floor((t.getTime() - freeUntil.getTime()) / day) + 1 > 0 ? Math.ceil((t.getTime() - freeUntil.getTime()) / day) : 0);
  // Day 15 onward counts: if today > freeUntil date
  const diff = Math.ceil((t.getTime() - freeUntil.getTime()) / day);
  const extra = diff > 0 ? diff : 0;
  const rate = overrideRate ?? globalDailyFee;
  return { extraDays: extra, fee: extra * rate };
}

export function calcTotals(lines: { unitPrice: number; qty: number }[], creditApplied = 0): number {
  const gross = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return Math.max(0, gross - creditApplied);
}

export function paymentDiff(expected: number, paid: number): { status: 'confirmed' | 'underpayment' | 'overpayment'; diff: number } {
  if (paid === expected) return { status: 'confirmed', diff: 0 };
  if (paid < expected) return { status: 'underpayment', diff: expected - paid };
  return { status: 'overpayment', diff: paid - expected };
}

export function formatOrderId(n: number): string {
  return `LVS-${String(n).padStart(3, '0')}`;
}

// --- v1.2 Phase 5 add (pure, no hard-coded bank/days/note — values passed in) ---
export function last4OfPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.slice(-4).padStart(4, '0');
}

export function formatOrderIdV12(serial: number, phone: string): string {
  const s = String(Math.max(1, Math.floor(serial))).padStart(3, '0');
  return `LVS-${s}-${last4OfPhone(phone)}`;
}

export function parseOrderIdV12(id: string): { serial: number; last4: string } | null {
  const m = /^LVS-(\d{3,})-(\d{4})$/.exec((id || '').trim().toUpperCase());
  if (!m) return null;
  return { serial: Number(m[1]), last4: m[2] };
}

// Abandon: fee unpaid + no contact >= abandonDays → flag (never automatic release)
export function isAbandoned(feeUnpaid: number, noContactDays: number, abandonDays = 60): boolean {
  return feeUnpaid > 0 && noContactDays >= abandonDays;
}

// Race loss: stock gone at verify → full amount to Store Credit auto
export function raceLossToCredit(paidAmount: number): { credit: number; reason: string } {
  return { credit: Math.max(0, paidAmount), reason: 'race-loss-auto-credit' };
}

// Under expired / Rejected → paid amount to Store Credit auto
export function underExpiredToCredit(paidAmount: number, status: string): { credit: number; reason: string } | null {
  if (status === 'expired' || status === 'rejected') {
    return { credit: Math.max(0, paidAmount), reason: `under-${status}-auto-credit` };
  }
  return null;
}

// Money rule: every naira received = confirmed orders total + credit ledger total
export function moneyRuleBalanced(received: number, confirmedTotal: number, creditTotal: number): boolean {
  return received === confirmedTotal + creditTotal;
}

// WhatsApp manual update link (₦0, no API, admin presses send)
export function waUpdateLink(phone: string, orderId: string, status: string): string {
  const d = (phone || '').replace(/\D/g, '');
  const text = encodeURIComponent(`Hello from Lakky Variety Store. Order ${orderId} is now: ${status}.`);
  return `https://wa.me/${d}?text=${text}`;
}
