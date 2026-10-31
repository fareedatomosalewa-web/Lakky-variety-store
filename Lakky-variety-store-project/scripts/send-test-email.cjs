// Sends ONE real test email so the owner can see where it lands (inbox or spam).
//
// Before running, put these two lines in .env.local (never in GitHub):
//   GMAIL_USER=your-shop@gmail.com
//   GMAIL_APP_PASSWORD=the 16-character Google App Password
//
// Then run:
//   node scripts/send-test-email.cjs you@example.com
//
// It prints OK + the Gmail reply, or a short error code. It never prints the password.
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

function readEnv() {
  const file = path.join(__dirname, '..', '.env.local');
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
}

(async () => {
  const to = process.argv[2];
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    console.error('Usage: node scripts/send-test-email.cjs you@example.com');
    process.exit(2);
  }

  const env = { ...readEnv(), ...process.env };
  const user = env.GMAIL_USER;
  const pass = String(env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) {
    console.error('MISSING GMAIL_USER or GMAIL_APP_PASSWORD in .env.local');
    process.exit(2);
  }

  const name = env.MAIL_FROM_NAME || 'Lakky Variety Store';
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT || 465),
    secure: String(env.SMTP_SECURE || 'true') !== 'false',
    auth: { user, pass },
    connectionTimeout: 20000,
    socketTimeout: 30000,
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  try {
    const info = await transport.sendMail({
      from: `"${name}" <${user}>`,
      to,
      subject: `TEST - Your ${name} password reset code: ${code}`,
      text: [
        `Hello,`,
        '',
        'This is a test of the password-reset email, sent by the shop owner.',
        `Your test 6-digit code is: ${code}`,
        '',
        'If this message is in your Spam folder, please mark it "Not spam" so',
        'real reset emails reach your customers.',
        '',
        name,
      ].join('\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="margin:0 0 8px">Test email ✓</h2>
        <p>This is a test of the password-reset email, sent by the shop owner.</p>
        <p>Test code: <b style="font-size:24px;letter-spacing:6px">${code}</b></p>
        <p style="color:#57534e">If this message is in your <b>Spam</b> folder, mark it <b>"Not spam"</b> so real reset emails reach your customers.</p>
        <p style="color:#57534e">${name}</p>
      </div>`,
    });
    console.log('SEND_OK');
    console.log('accepted = ' + JSON.stringify(info.accepted));
    console.log('rejected = ' + JSON.stringify(info.rejected));
    console.log('messageId = ' + info.messageId);
    console.log('response  = ' + info.response);
    console.log('');
    console.log('Now open the inbox for ' + to + ' and check Inbox AND Spam.');
  } catch (e) {
    console.error('SEND_FAILED ' + (e.code || '') + ' ' + String(e.message).slice(0, 200));
    if (String(e.code) === 'EAUTH') {
      console.error('Hint: GMAIL_APP_PASSWORD must be the 16-character App Password, and 2-Step Verification must be ON.');
    }
    process.exit(1);
  }
})();
