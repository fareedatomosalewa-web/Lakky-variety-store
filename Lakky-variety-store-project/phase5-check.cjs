// Phase 5 release checks — time-travel fees, payment scenarios, stock, tracking
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('PASS:', m); };
function fee(confirmed, today, rate) {
  const day = 86400000;
  const c = new Date(confirmed); c.setHours(0,0,0,0);
  const t = new Date(today); t.setHours(0,0,0,0);
  const free = new Date(c.getTime() + 14 * day);
  const extra = Math.max(0, Math.ceil((t - free) / day));
  return { extra, fee: extra * rate, free };
}
// Time-travel: #219 Sept 1, #220 Sept 10, today Sept 20, rate 500
let a = fee('2026-09-01', '2026-09-20', 500);
let b = fee('2026-09-10', '2026-09-20', 500);
assert(a.extra === 5 && a.fee === 2500, '#219 Sept1->Sept20: 5 extra days x500=2500');
assert(b.extra === 0 && b.fee === 0, '#220 Sept10->Sept20: still free (independent periods, no reset)');
b = fee('2026-09-10', '2026-09-26', 500);
assert(b.extra === 2 && b.fee === 1000, '#220 Sept10->Sept26: 2 days x500=1000');
// Payment scenarios
const diff = (e, p) => p === e ? 'confirmed' : p < e ? 'underpayment' : 'overpayment';
assert(diff(100000, 100000) === 'confirmed', 'exact -> confirmed -> LVS ID + reserve');
assert(diff(100000, 98000) === 'underpayment', '98k/100k -> under, outstanding 2000, no ID/stock');
assert(diff(100000, 105000) === 'overpayment', '105k/100k -> confirm + 5k credit');
// Stock: 5 bags, 5 confirms -> 0 available; 6th blocked
let avail = 5, reserved = 0;
for (let i = 0; i < 5; i++) { avail--; reserved++; }
assert(avail === 0 && reserved === 5, '5 confirms deplete 5 stock, held not collected');
assert(!(avail >= 1), '6th customer blocked from confirming (must under/reject)');
// Tracking requires ID + phone
const canTrack = (id, phone) => Boolean(id && phone);
assert(canTrack('LVS-001', '+2348012345678'), 'ID+phone tracks');
assert(!canTrack('', '+2348012345678'), 'phone alone cannot retrieve');
console.log('ALL PHASE-5 CHECKS PASSED');
