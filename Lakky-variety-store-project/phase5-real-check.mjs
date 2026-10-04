// Direct tests of the REAL lib/domain.ts (imported, not copied).
// Run: node phase5-real-check.mjs
import { raceLossToCredit, underExpiredToCredit, moneyRuleBalanced, canConfirm } from './lib/domain.ts';
import { formatOrderIdV12, parseOrderIdV12, last4OfPhone, isAbandoned, waUpdateLink } from './lib/domain.ts';
import { trackAllowedByIP, last4Match } from './lib/harden.ts';

let fails = 0;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); fails++; } else console.log('PASS:', m); };

// 1. raceLossToCredit — real function
{
  const r = raceLossToCredit(100000);
  assert(r.credit === 100000 && r.reason === 'race-loss-auto-credit', 'REAL raceLossToCredit(100000) → full credit + reason');
  const z = raceLossToCredit(0);
  assert(z.credit === 0, 'REAL raceLossToCredit(0) → zero credit');
}

// 2. underExpiredToCredit — real function
{
  const e = underExpiredToCredit(40000, 'expired');
  assert(e !== null && e.credit === 40000, 'REAL underExpiredToCredit expired → 40000 credit');
  const rj = underExpiredToCredit(40000, 'rejected');
  assert(rj !== null && rj.credit === 40000, 'REAL underExpiredToCredit rejected → 40000 credit');
  assert(underExpiredToCredit(40000, 'pending') === null, 'REAL underExpiredToCredit pending → null (no credit yet)');
}

// 3. moneyRuleBalanced — real function
{
  assert(moneyRuleBalanced(100000, 95000, 5000) === true, 'REAL moneyRuleBalanced 95k+5k=100k → true');
  assert(moneyRuleBalanced(100000, 95000, 4000) === false, 'REAL moneyRuleBalanced 95k+4k≠100k → false');
}

// 4. Seen-in-bank gate — real canConfirm used by Admin verify UI
{
  const blocked = canConfirm({ seenBank: false, paid: 100000, expected: 100000 });
  assert(blocked.ok === false, 'REAL gate: Confirm BLOCKED until ticked (seenBank=false)');
  const allowed = canConfirm({ seenBank: true, paid: 100000, expected: 100000 });
  assert(allowed.ok === true, 'REAL gate: Confirm ALLOWED after ticked (seenBank=true, full pay)');
  const under = canConfirm({ seenBank: true, paid: 98000, expected: 100000 });
  assert(under.ok === false, 'REAL gate: Confirm BLOCKED on underpayment even when ticked');
}

if (fails) { console.error(`REAL-CODE TESTS FAILED: ${fails}`); process.exit(1); }
console.log('ALL REAL-CODE TESTS PASSED');

// ---- Group B: reports + the rest, verified against real code ----
{
  // 5. New Order ID LVS-serial-last4 — real functions
  assert(formatOrderIdV12(9, '+2348012349270') === 'LVS-009-9270', 'REAL formatOrderIdV12 → LVS-009-9270');
  const parsed = parseOrderIdV12('LVS-009-9270');
  assert(parsed !== null && parsed.serial === 9 && parsed.last4 === '9270', 'REAL parseOrderIdV12 round-trips serial+last4');
  assert(last4OfPhone('+2348012349270') === '9270', 'REAL last4OfPhone → 9270');
  assert(last4Match('+2348012349270', '9270') === true, 'REAL last4Match hits');
  assert(last4Match('+2348012349270', '1111') === false, 'REAL last4Match misses wrong last4');
  // 6. Abandon — real function
  assert(isAbandoned(2500, 60, 60) === true, 'REAL isAbandoned fee+60d → true');
  assert(isAbandoned(2500, 59, 60) === false, 'REAL isAbandoned 59d → false');
  assert(isAbandoned(0, 90, 60) === false, 'REAL isAbandoned no fee → false');
  // 8. WhatsApp link — real function, manual wa.me, no API
  const wa = waUpdateLink('+2348012349270', 'LVS-009-9270', 'Ready');
  assert(wa.startsWith('https://wa.me/2348012349270?text='), 'REAL waUpdateLink → wa.me link with order text');
  // 9. Track rate-limit 5/hour/IP — real function
  const ip = '9.9.9.' + Math.floor(Math.random() * 200 + 50);
  let ok = 0;
  for (let i = 0; i < 5; i++) if (trackAllowedByIP(ip)) ok++;
  assert(ok === 5, 'REAL trackAllowedByIP allows 5 tries');
  assert(trackAllowedByIP(ip) === false, 'REAL trackAllowedByIP blocks 6th (lock 1 hr)');
}

if (fails) { console.error(`GROUP-B REAL TESTS FAILED: ${fails}`); process.exit(1); }
console.log('ALL GROUP-B REAL TESTS PASSED');
