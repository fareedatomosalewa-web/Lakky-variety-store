// Creates the Web Push keys ONCE and writes them to .env.local.
//
//   node scripts/gen-vapid.cjs
//
// Safety: if keys already exist it refuses to change them. Changing the keys
// after customers/owner have switched notifications on would make every
// existing phone stop receiving them.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const file = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(file)) {
  console.error('FAIL: .env.local not found.');
  process.exit(2);
}
let txt = fs.readFileSync(file, 'utf8');
const hasPub = /^VAPID_PUBLIC_KEY=\S/m.test(txt);
const hasPriv = /^VAPID_PRIVATE_KEY=\S/m.test(txt);
if (hasPub || hasPriv) {
  console.log('SKIPPED: VAPID keys already exist in .env.local (not changed).');
  process.exit(0);
}

const keys = webpush.generateVAPIDKeys();
if (!txt.endsWith('\n')) txt += '\n';
txt += 'VAPID_PUBLIC_KEY=' + keys.publicKey + '\n';
txt += 'VAPID_PRIVATE_KEY=' + keys.privateKey + '\n';
if (!/^VAPID_SUBJECT=\S/m.test(txt)) txt += 'VAPID_SUBJECT=mailto:owner@lakky.store\n';
fs.writeFileSync(file, txt);
console.log('ADDED: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT to .env.local');
console.log('Copy those three lines into Vercel -> Environment Variables before deploying.');
