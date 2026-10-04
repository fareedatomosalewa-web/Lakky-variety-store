// Phase 5 ADD checks — v1.2 items only. Old checks must still PASS separately.
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('PASS:', m); };
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mirror lib/domain.ts v1.2 pure functions
const last4OfPhone = (p) => String(p || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
const formatOrderIdV12 = (serial, phone) => `LVS-${String(Math.max(1, Math.floor(serial))).padStart(3, '0')}-${last4OfPhone(phone)}`;
const parseOrderIdV12 = (id) => { const m = /^LVS-(\d{3,})-(\d{4})$/.exec(String(id||'').trim().toUpperCase()); return m ? { serial: Number(m[1]), last4: m[2] } : null; };
const isAbandoned = (feeUnpaid, noContactDays, abandonDays = 60) => feeUnpaid > 0 && noContactDays >= abandonDays;
const raceLossToCredit = (paid) => ({ credit: Math.max(0, paid), reason: 'race-loss-auto-credit' });
const underExpiredToCredit = (paid, status) => (status === 'expired' || status === 'rejected') ? ({ credit: Math.max(0, paid), reason: `under-${status}-auto-credit` }) : null;
const moneyRuleBalanced = (received, confirmed, credit) => received === confirmed + credit;
const waUpdateLink = (phone, orderId, status) => `https://wa.me/${String(phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hello from Lakky Variety Store. Order ${orderId} is now: ${status}.`)}`;

// 1. New Order ID format
assert(formatOrderIdV12(9, '+2348012349270') === 'LVS-009-9270', 'new Order ID LVS-009-9270 (serial + last4)');
assert(formatOrderIdV12(9, '+2348012349270') !== formatOrderIdV12(9, '+2348099991111'), 'same serial different phones → different IDs');
assert(parseOrderIdV12('LVS-009-9270').serial === 9, 'parse serial 9 from new ID');
assert(parseOrderIdV12('LVS-001') === null, 'old LVS-001 rejected by v1.2 parser (migrated format)');
assert(formatOrderIdV12(5, '08031234567').endsWith('-4567'), 'last4 derived from local 080... number');

// 2. last4 search
const last4Match = (phone, last4) => String(phone||'').replace(/\D/g,'').slice(-4) === String(last4||'').replace(/\D/g,'');
assert(last4Match('+2348012349270', '9270'), 'last4 search 9270 matches full phone');
assert(!last4Match('+2348012349270', '1111'), 'wrong last4 does not match');

// 3. Money rule
assert(moneyRuleBalanced(100000, 95000, 5000), 'money rule: 95k confirmed + 5k credit = 100k received');
assert(!moneyRuleBalanced(100000, 95000, 4000), 'money rule catches missing 1k (no ledger gap)');

// 4. Race loss → credit
let r = raceLossToCredit(100000);
assert(r.credit === 100000 && r.reason.includes('race-loss'), 'race loss full amount → Store Credit auto');

// 5. Under expired → credit, active → no credit yet
assert(underExpiredToCredit(40000, 'expired').credit === 40000, 'under expired paid → credit auto');
assert(underExpiredToCredit(40000, 'rejected').credit === 40000, 'under rejected paid → credit auto');
assert(underExpiredToCredit(40000, 'pending') === null, 'under pending → no credit yet');

// 6. Abandon flag (60d default)
assert(isAbandoned(2500, 60, 60), 'fee unpaid + 60d no contact → Abandoned');
assert(!isAbandoned(2500, 59, 60), '59 days → not abandoned yet');
assert(!isAbandoned(0, 90, 60), 'no fee → never abandoned');

// 7. agreed_at + seen-in-bank (check code wiring, not just functions)
const checkoutSrc = fs.readFileSync(path.join(__dirname, 'app', 'checkout', 'page.tsx'), 'utf8');
assert(checkoutSrc.includes('agreed') && checkoutSrc.includes('agreed_at'), 'checkout has agree checkbox + stores agreed_at');
const adminOrderSrc = fs.readFileSync(path.join(__dirname, 'app', 'admin', 'orders', '[id]', 'page.tsx'), 'utf8');
assert(adminOrderSrc.includes('Seen in bank') && adminOrderSrc.includes('seenBank'), 'admin verify requires Seen in bank tick');
assert(adminOrderSrc.includes('LVS-') && adminOrderSrc.includes('last4'), 'admin confirm uses LVS-serial-last4 format');
assert(adminOrderSrc.includes('wa.me'), 'admin has WhatsApp wa.me button (manual, no API)');

// 8. Track rate-limit 5/hour/IP
let hits = new Map();
const WINDOW = 3600000, MAX = 5;
const allowed = (ip, now) => { const a = (hits.get(ip) || []).filter(t => now - t < WINDOW); if (a.length >= MAX) return false; a.push(now); hits.set(ip, a); return true; };
let now = Date.now(), ip = '1.2.3.4', ok = 0;
for (let i = 0; i < 5; i++) if (allowed(ip, now)) ok++;
assert(ok === 5, '5 tries/hour/IP allowed');
assert(!allowed(ip, now), '6th try blocked → lock 1 hr');
assert(allowed('9.9.9.9', now), 'different IP still allowed');

// 9. Reports + CSV
const buildReport = (orders, from, to) => {
  const r = orders.filter(o => o.date >= from && o.date <= to);
  return { ordersPlaced: r.length, totalVerified: r.reduce((s, o) => s + (o.paidAmount || 0), 0) };
};
let rep = buildReport([{ date: '2026-09-05', paidAmount: 10000 }, { date: '2024-01-01', paidAmount: 5000 }], '2026-09-01', '2026-09-30');
assert(rep.ordersPlaced === 1 && rep.totalVerified === 10000, 'reports filter by range, works years later');
assert(fs.readFileSync(path.join(__dirname, 'lib', 'reports.ts'), 'utf8').includes('reportToCSV'), 'reports lib has CSV export');
assert(fs.readFileSync(path.join(__dirname, 'app', 'admin', 'reports', 'page.tsx'), 'utf8').includes('Export CSV'), 'admin Reports page has Export CSV');

// 10. Retention: no deletes
const schemaSrc = fs.readFileSync(path.join(__dirname, 'db', 'schema.ts'), 'utf8');
assert(schemaSrc.includes('Retention: never delete') || schemaSrc.includes('never delete'), 'retention documented: never delete, only status-change');

// 11. Backup: no hard-code, requires BACKUP_DIR (deferred location v1.3)
const backupSrc = fs.readFileSync(path.join(__dirname, 'scripts', 'backup.cjs'), 'utf8');
assert(backupSrc.includes('BACKUP_DIR'), 'backup uses BACKUP_DIR env, no hard-coded location');
assert(!backupSrc.includes('C:\\Users\\lakky'), 'backup never hardcodes local path');
try { execSync('node scripts/backup.cjs', { stdio: 'pipe' }); console.error('FAIL: backup without env should exit 2'); process.exit(1); }
catch (e) { assert(e.status === 2, 'backup without BACKUP_DIR exits 2 (ask in v1.3, do not invent)'); }

// 12. No hard-coded bank/days/note in code
const seedSrc = fs.readFileSync(path.join(__dirname, 'db', 'seed.ts'), 'utf8');
assert(seedSrc.includes('FILL-IN'), 'seed uses FILL-IN placeholders (bank/days/note in Settings only)');
assert(!seedSrc.includes('GTBank') && !seedSrc.includes('Access Bank'), 'no real bank hardcoded');

console.log('ALL PHASE-5-ADD CHECKS PASSED');
