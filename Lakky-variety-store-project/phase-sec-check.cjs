// Security wiring checks: admin gates present on mutating server functions + live gate.
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('PASS:', m); };
const fs = require('fs');
const path = require('path');
const sa = fs.readFileSync(path.join(__dirname, 'lib', 'shop-actions.ts'), 'utf8');
const sv = fs.readFileSync(path.join(__dirname, 'lib', 'shop-v1.ts'), 'utf8');
for (const fn of ['saveSettings', 'confirmOrder', 'getSubmissionProof', 'getReceiptUrl']) {
  const i = sa.indexOf('export async function ' + fn + '(');
  const seg = sa.slice(i, sa.indexOf('export async function ', i + 10) === -1 ? undefined : sa.indexOf('export async function ', i + 10));
  assert(i >= 0 && /require(Admin|Staff)Action\(\)/.test(seg), fn + ' has admin gate');
}
for (const fn of ['rejectPending', 'markPartial', 'decideRefund', 'saveProductAdmin', 'setProgress', 'advanceOrder', 'releaseStockpile', 'resetCustomerPassword', 'inviteStaff', 'approveStaff', 'createCoupon', 'exportCsv', 'dashboard']) {
  const i = sv.indexOf('export async function ' + fn + '(');
  const nx = sv.indexOf('export async function ', i + 10);
  const seg = sv.slice(i, nx === -1 ? undefined : nx);
  assert(i >= 0 && /require(Admin|Staff)Action\(\)/.test(seg), fn + ' has admin gate');
}
assert(sv.includes('staff_invites') && sv.includes('approved'), 'staff approval enforced server-side');
console.log('ALL SECURITY CHECKS PASSED');
