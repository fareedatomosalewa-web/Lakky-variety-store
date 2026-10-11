// Strip checks — owner: no How-it-works, no fee text for guests; Track link stays.
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('PASS:', m); };
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'app', 'page.tsx'), 'utf8');
assert(!src.includes('How it works'), 'no How-it-works block on customer home');
assert(!src.includes('Upload your receipt') && !src.includes('Upload proof'), 'no receipt-steps text on customer home');
assert(src.includes('/orders') && src.includes('Track your order'), 'strip links Track your order → /orders');
assert(src.includes('wa.me') && src.includes('waNumber'), 'strip WhatsApp wa.me uses number from Settings');
assert(!/Free 14-day/i.test(src), 'no hardcoded 14-day in strip');
assert(!/₦500\/day/.test(src) && !/Fee ₦500/.test(src), 'no hardcoded fee in strip');
assert(!/wa\.me\/234\d{9,}/.test(src), 'no hardcoded WhatsApp number in strip');
assert(src.includes('Mixed catalogue'), '/ still product grid below strip');
assert(src.includes('seedProducts'), 'strip reuses existing catalogue grid, no new tables');
const css = fs.readFileSync(path.join(__dirname, 'app', 'globals.css'), 'utf8');
assert(css.includes('.strip'), 'strip has 360px-first style');
console.log('ALL STRIP CHECKS PASSED');
