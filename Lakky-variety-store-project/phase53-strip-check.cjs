// Strip checks — owner design pictures: 3-step boxes (Choose/Transfer/Upload receipt) + Track.
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('PASS:', m); };
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'app', 'page.tsx'), 'utf8');
assert(src.includes('1') && src.includes('Choose') && src.includes('Transfer') && src.includes('Upload receipt'), 'strip shows 3 steps Choose → Transfer → Upload receipt');
assert(src.includes('/orders') && src.includes('Track your order'), 'strip links Track your order → /orders');
assert(src.includes('wa.me') && src.includes('waNumber'), 'strip WhatsApp wa.me uses number from Settings');
assert(!/Free 14-day/i.test(src), 'no hardcoded 14-day in strip');
assert(!/₦500\/day/.test(src) && !/Fee ₦500/.test(src), 'no hardcoded fee in strip');
assert(!/wa\.me\/234\d{9,}/.test(src), 'no hardcoded WhatsApp number in strip');
assert(src.includes('Mixed catalogue'), '/ still product grid below strip');
assert(src.includes('seedProducts'), 'strip reuses existing catalogue grid, no new tables');
const css = fs.readFileSync(path.join(__dirname, 'app', 'globals.css'), 'utf8');
assert(css.includes('.steps'), 'steps have styled 3-box row');
console.log('ALL STRIP CHECKS PASSED');
