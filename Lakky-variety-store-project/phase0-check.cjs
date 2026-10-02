// Phase 0 domain check — mirrors lib/domain.ts, plain JS so portable node can run it
function calcFee(confirmedAt, today, globalDailyFee, overrideRate) {
  const day = 86400000;
  const c = new Date(confirmedAt); c.setHours(0,0,0,0);
  const t = new Date(today); t.setHours(0,0,0,0);
  const freeUntil = new Date(c.getTime() + 14 * day);
  const diff = Math.ceil((t.getTime() - freeUntil.getTime()) / day);
  const extra = diff > 0 ? diff : 0;
  return { extraDays: extra, fee: extra * (overrideRate ?? globalDailyFee), freeUntil };
}
function paymentDiff(expected, paid) {
  if (paid === expected) return { status: 'confirmed', diff: 0 };
  if (paid < expected) return { status: 'underpayment', diff: expected - paid };
  return { status: 'overpayment', diff: paid - expected };
}
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('PASS:', msg); };

// LVS-001 formatter
const fmt = (n) => `LVS-${String(n).padStart(3,'0')}`;
assert(fmt(1) === 'LVS-001', 'Order ID starts at LVS-001');
assert(fmt(220) === 'LVS-220', 'Order ID pads correctly');

// Fee: confirmed Sept 1, today Sept 15 -> free until Sept 15, extra 0... today Sept 16 -> extra 1
let r = calcFee(new Date('2026-09-01'), new Date('2026-09-15'), 500, null);
assert(r.extraDays === 0 && r.fee === 0, 'Day 14 free, no fee');
r = calcFee(new Date('2026-09-01'), new Date('2026-09-16'), 500, null);
assert(r.extraDays === 1 && r.fee === 500, 'Day 15 = 1 day x 500');
r = calcFee(new Date('2026-09-01'), new Date('2026-09-20'), 500, 2000);
assert(r.extraDays === 5 && r.fee === 10000, 'Bulky override 5 x 2000');

// Payments
assert(paymentDiff(100000, 100000).status === 'confirmed', 'exact = confirmed');
assert(paymentDiff(100000, 98000).diff === 2000, 'underpayment outstanding 2000');
assert(paymentDiff(100000, 105000).diff === 5000, 'overpayment excess 5000');

console.log('ALL PHASE-0 DOMAIN CHECKS PASSED');
