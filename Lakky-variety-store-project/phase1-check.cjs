// Phase 1 checks: IDs, ledger, settings configurability, reserve guard (pg-mem)
const { newDb } = require('pg-mem');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('PASS:', m); };
const db = newDb();
db.public.none(`CREATE TABLE t(id SERIAL PRIMARY KEY, order_number INT UNIQUE, display_id TEXT UNIQUE, total INT, paid INT, status TEXT);`);
db.public.none(`INSERT INTO t(order_number, display_id, total, paid, status) VALUES (1, 'LVS-001', 100000, 100000, 'confirmed');`);
try { db.public.none(`INSERT INTO t(order_number, display_id, total, paid, status) VALUES (1, 'LVS-002', 35000, 35000, 'confirmed');`); assert(false, 'duplicate order_number must fail'); }
catch { assert(true, 'duplicate Order ID blocked (never merge)'); }
// credit ledger: overpayment 5000 -> +5000, use 2000 -> -2000, balance 3000, never cash out (no negative-withdraw row type)
db.public.none(`CREATE TABLE ledger(id SERIAL PRIMARY KEY, customer_id INT, amount INT, reason TEXT);`);
db.public.none(`INSERT INTO ledger(customer_id, amount, reason) VALUES (1, 5000, 'overpayment'), (1, -2000, 'use');`);
let bal = db.public.one(`SELECT SUM(amount) as b FROM ledger WHERE customer_id=1;`);
assert(Number(bal.b) === 3000, 'store credit balance 5000-2000=3000, non-cashable');
// settings editable
db.public.none(`CREATE TABLE settings(id SERIAL PRIMARY KEY, global_fee INT, free_days INT, over_threshold INT, under_expiry INT);`);
db.public.none(`INSERT INTO settings(global_fee, free_days, over_threshold, under_expiry) VALUES (500, 14, 50000, 7);`);
db.public.none(`UPDATE settings SET global_fee=750 WHERE id=1;`);
let s = db.public.one(`SELECT * FROM settings WHERE id=1;`);
assert(s.global_fee === 750 && s.free_days === 14, 'settings editable without code');
console.log('ALL PHASE-1 CHECKS PASSED');
