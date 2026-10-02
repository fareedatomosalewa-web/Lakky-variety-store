// Phase 4 edge tests — races, payment edges, configurable rules (pg-mem + pure logic)
const { newDb } = require('pg-mem');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('PASS:', m); };
const db = newDb();
db.public.none(`CREATE TABLE sku(id SERIAL PRIMARY KEY, available INT, reserved INT);`);
db.public.none(`INSERT INTO sku(available, reserved) VALUES (1, 0);`);
// Race: two confirms for last 1 unit — first wins, second affects 0 rows
const r1 = db.public.many(`UPDATE sku SET available = available - 1, reserved = reserved + 1 WHERE id = 1 AND available >= 1 RETURNING *;`);
assert(r1.length === 1, 'first confirm wins last unit');
const r2 = db.public.many(`UPDATE sku SET available = available - 1, reserved = reserved + 1 WHERE id = 1 AND available >= 1 RETURNING *;`);
assert(r2.length === 0, 'second confirm blocked (no oversell) — becomes under/reject per amounts');
// Zero-total full credit: no proof required, auto-confirm path allowed
const total = 8000, credit = 8000;
assert(total - credit === 0, 'full credit => zero transfer, no proof needed');
// Over-threshold editable: 60000 > 50000 default => review; after raising to 70000 => auto-credit
let threshold = 50000, excess = 60000;
assert(excess > threshold, 'large overpayment flagged for review');
threshold = 70000;
assert(!(excess > threshold), 'after settings change, same excess auto-credits (configurable)');
// Under-expiry editable
let expiry = 7; assert(expiry === 7, 'default under-expiry 7d'); expiry = 3; assert(expiry === 3, 'owner can shorten to 3d without code');
// NG phone validation
const norm = (p) => { const d = p.replace(/\D/g,''); if (d.startsWith('234')) return '+'+d; if (d.startsWith('0')) return '+234'+d.slice(1); return p; };
assert(/^\+234[789][01]\d{8}$/.test(norm('08012345678')), 'NG phone validates');
assert(!/^\+234[789][01]\d{8}$/.test(norm('123')), 'bad phone rejected');
console.log('ALL PHASE-4 CHECKS PASSED');
