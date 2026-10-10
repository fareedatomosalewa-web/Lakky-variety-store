// V1 shop checks: pure-logic asserts on the REAL lib files (no copies).
import { discountFor, tierPrice, makeRef } from './lib/pricing.ts';
let fails = 0;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); fails++; } else console.log('PASS:', m); };
const seen = new Set();
for (let i = 0; i < 20; i++) {
  const r = makeRef();
  assert(/^REF-[A-HJ-NP-Z2-9]{6}$/.test(r), 'REF pattern short, no O/0/I/1: ' + r);
  assert(!seen.has(r), 'REF unique');
  seen.add(r);
}
assert(tierPrice([{ min: 5, max: 11, each: 450 }, { min: 12, each: 400 }], 1, 500) === 500, 'tier qty 1 → base');
assert(tierPrice([{ min: 5, max: 11, each: 450 }, { min: 12, each: 400 }], 7, 500) === 450, 'tier qty 7 → 450');
assert(tierPrice([{ min: 5, max: 11, each: 450 }, { min: 12, each: 400 }], 12, 500) === 400, 'tier qty 12 → 400');
const d1 = discountFor({ basePrice: 10000, discount_type: 'percent', discount_value: 10 });
assert(d1 && d1.price === 9000, 'percent discount 10% off 10000 → 9000');
const d2 = discountFor({ basePrice: 10000, discount_type: 'amount', discount_value: 1500 });
assert(d2 && d2.price === 8500, 'amount discount 1500 off → 8500');
assert(discountFor({ basePrice: 10000 }) === null, 'no discount → null');
if (fails) { console.error(`V1 SHOP CHECKS FAILED: ${fails}`); process.exit(1); }
console.log('ALL V1 SHOP CHECKS PASSED');
