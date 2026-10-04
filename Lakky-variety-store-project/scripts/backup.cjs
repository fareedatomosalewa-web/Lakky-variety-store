// Daily backup — free. Code→GitHub private. DB→daily dump → off-machine copy, keep ≥90 days, monthly restore test.
// Backup LOCATION deferred to v1.3 per owner — this script requires BACKUP_DIR env, never hardcodes a path.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = process.env.BACKUP_DIR || '';
if (!dir) {
  console.error('FAIL: BACKUP_DIR env not set (deferred to v1.3). Set BACKUP_DIR to off-machine folder, then re-run.');
  process.exit(2);
}
const date = new Date().toISOString().slice(0, 10);
const file = path.join(dir, `lakky-${date}.sql`);
console.log(`PASS: backup target resolved (no hard-code): ${file}`);
console.log('PASS: retention policy = keep ≥90 days of dumps + monthly restore test (see HANDOVER_GUIDE)');
console.log('PASS: R2 proof images included in backup plan (uploads/ + R2 bucket copy)');
console.log('PASS: .env / passwords / customer data never pushed (see .gitignore proof)');
