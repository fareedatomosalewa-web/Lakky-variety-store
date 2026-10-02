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
