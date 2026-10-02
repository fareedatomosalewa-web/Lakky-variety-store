// Phase 0 DB smoke — pg-mem (free, no install), mirrors reserve/release rule
const { newDb } = require('pg-mem');
const db = newDb();
db.public.none(`CREATE TABLE variant_skus(id SERIAL PRIMARY KEY, attrs TEXT, price INT, available INT, reserved INT);`);
db.public.none(`INSERT INTO variant_skus(attrs, price, available, reserved) VALUES ('Black+9', 12000, 2, 0);`);
// Confirm 1 unit: only if available >= qty
db.public.none(`UPDATE variant_skus SET available = available - 1, reserved = reserved + 1 WHERE id = 1 AND available >= 1;`);
let row = db.public.one(`SELECT available, reserved FROM variant_skus WHERE id = 1;`);
console.log('after confirm 1:', row);
if (row.available !== 1 || row.reserved !== 1) { console.error('FAIL reserve'); process.exit(1); }
// Over-reserve 5 units must not go negative (guarded update affects 0 rows)
db.public.none(`UPDATE variant_skus SET available = available - 5, reserved = reserved + 5 WHERE id = 1 AND available >= 5;`);
row = db.public.one(`SELECT available, reserved FROM variant_skus WHERE id = 1;`);
console.log('after blocked over-reserve:', row);
if (row.available !== 1 || row.reserved !== 1) { console.error('FAIL guard'); process.exit(1); }
console.log('ALL PHASE-0 DB CHECKS PASSED (pg-mem, free local stand-in for Postgres)');
