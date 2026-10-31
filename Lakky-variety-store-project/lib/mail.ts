// Server-only email sender for the shop.
// Sends through Gmail SMTP using an App Password (never the normal Gmail password).
// The password lives ONLY in environment variables (.env.local locally, Vercel in
// production). It is never written to the repo and never sent to the browser.
import nodemailer from 'nodemailer';

const DEFAULT_FROM_NAME = 'Lakky Variety Store';

export function mailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function appPassword(): string {
  // Google shows the App Password in 4 groups of 4; spaces are cosmetic.
  return String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
}

function fromHeader(): string {
  const name = (process.env.MAIL_FROM_NAME || DEFAULT_FROM_NAME).replace(/"/g, '');
  const user = String(process.env.GMAIL_USER || '');
  return `"${name}" <${user}>`;
}

function transport() {
  const secure = String(process.env.SMTP_SECURE || 'true') !== 'false';
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure,
    auth: { user: String(process.env.GMAIL_USER || ''), pass: appPassword() },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

export type MailResult = { ok: boolean; reason?: string };

export async function sendMail(args: { to: string; subject: string; text: string; html?: string }): Promise<MailResult> {
  if (!mailConfigured()) return { ok: false, reason: 'mail-not-configured' };
  const to = String(args.to || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, reason: 'bad-address' };
  try {
    const info = await transport().sendMail({
      from: fromHeader(),
      to,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { ok: Boolean(info && (info.accepted?.length || info.messageId)) };
  } catch (e: any) {
    // Keep the reason short and secret-free: useful in logs, safe to show.
    const code = String(e?.code || e?.responseCode || 'send-failed');
    return { ok: false, reason: code };
  }
}

// Check the Gmail login works without sending anything. Used by the test script.
export async function verifyMailer(): Promise<MailResult> {
  if (!mailConfigured()) return { ok: false, reason: 'mail-not-configured' };
  try {
    await transport().verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: String(e?.code || e?.responseCode || 'verify-failed') };
  }
}

function codeEmail(code: string, name: string): { subject: string; text: string; html: string } {
  const safeName = String(name || 'there').slice(0, 60);
  const subject = `Your Lakky Variety Store password reset code: ${code}`;
  const text = [
    `Hello ${safeName},`,
    '',
    'You asked to reset your Lakky Variety Store password.',
    `Your 6-digit code is: ${code}`,
    '',
    'The code expires in 10 minutes and can be used once.',
    'If you did not ask for this, you can ignore this email - your password will not change.',
    '',
    'Lakky Variety Store',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#fafaf9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1917">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:14px;padding:28px">
    <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5A2948;font-weight:700">Lakky Variety Store</div>
    <h1 style="font-size:20px;margin:10px 0 6px">Reset your password</h1>
    <p style="margin:0 0 16px;color:#57534e">Hello ${safeName}, you asked to reset your password. Enter this code on the website:</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:10px;padding:16px 0;margin:0 0 16px">${code}</div>
    <p style="margin:0 0 8px;color:#57534e">The code expires in <b>10 minutes</b> and works once.</p>
    <p style="margin:0;color:#57534e">If you did not ask for this, ignore this email - your password will not change.</p>
    <hr style="border:0;border-top:1px solid #e7e5e4;margin:22px 0 12px">
    <div style="font-size:12px;color:#78716c">This is an automated message. Please do not reply.</div>
  </div></body></html>`;
  return { subject, text, html };
}

export async function sendPasswordResetCode(args: { to: string; code: string; name?: string }): Promise<MailResult> {
  const mail = codeEmail(args.code, args.name || 'there');
  return sendMail({ to: args.to, subject: mail.subject, text: mail.text, html: mail.html });
}
