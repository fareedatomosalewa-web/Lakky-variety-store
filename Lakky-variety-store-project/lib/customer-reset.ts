'use server';

// Customer password reset by email code.
// Flow: customer enters email -> we email a 6-digit code -> customer enters the
// code + a new password -> password changes and every old session is signed out.
//
// Safety rules:
//  - The reply never says whether an email belongs to an account (no leaking
//    who your customers are).
//  - Codes are stored only as a salted hash, expire in 10 minutes, work once,
//    and stop after 5 wrong guesses.
//  - A customer can ask for at most 5 codes per hour and 1 per minute.
import postgres from 'postgres';
import crypto from 'crypto';
import { sendPasswordResetCode, mailConfigured } from './mail';

function conn() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('no-db');
  return postgres(url, { prepare: false });
}

function hashCode(code: string, salt: string): string {
  return crypto.scryptSync(code, salt, 32).toString('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Step 1: ask for a code.
export async function requestResetCode(args: { email: string }) {
  const email = String(args.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { ok: false as const, reason: 'bad-email' as const };
  if (!mailConfigured()) return { ok: false as const, reason: 'mail-not-configured' as const };

  let sql;
  try {
    sql = conn();
    const rows = await sql`select id, full_name, email from customers where lower(email)=${email} limit 1`;
    if (!rows.length) {
      // Same answer as a real send, so nobody can test which emails exist.
      await sql.end();
      return { ok: true as const, mailed: true };
    }
    const customer = rows[0];

    const recent = await sql`select count(*)::int n, max(created_at) last
      from customer_password_resets
      where customer_id=${customer.id} and created_at > now() - interval '1 hour'`;
    if (recent[0].n >= 5) { await sql.end(); return { ok: false as const, reason: 'too-many' as const }; }
    if (recent[0].last && Date.now() - new Date(recent[0].last).getTime() < 60_000) {
      await sql.end();
      return { ok: false as const, reason: 'wait' as const };
    }

    // Only one live code per customer: close the older ones.
    await sql`update customer_password_resets set used_at=now()
      where customer_id=${customer.id} and used_at is null`;

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = crypto.randomBytes(16).toString('hex');
    const stored = salt + ':' + hashCode(code, salt);
    const expires = new Date(Date.now() + 10 * 60_000).toISOString();
    await sql`insert into customer_password_resets (customer_id, code_hash, expires_at)
      values (${customer.id}, ${stored}, ${expires})`;

    const mail = await sendPasswordResetCode({ to: customer.email, code, name: customer.full_name });
    await sql.end();

    if (!mail.ok) return { ok: false as const, reason: (mail.reason || 'send-failed') as string };
    return { ok: true as const, mailed: true };
  } catch {
    try { if (sql) await sql.end(); } catch {}
    return { ok: false as const, reason: 'error' as const };
  }
}

// Step 2: hand in the code + the new password.
export async function resetWithCode(args: { email: string; code: string; newPassword: string }) {
  const email = String(args.email || '').trim().toLowerCase();
  const code = String(args.code || '').replace(/\D/g, '');
  const newPassword = String(args.newPassword || '');
  if (!email || !EMAIL_RE.test(email)) return { ok: false as const, reason: 'bad-email' as const };
  if (code.length !== 6) return { ok: false as const, reason: 'bad-code' as const };
  if (newPassword.length < 6) return { ok: false as const, reason: 'weak-password' as const };

  let sql;
  try {
    sql = conn();
    const rows = await sql`select id from customers where lower(email)=${email} limit 1`;
    if (!rows.length) { await sql.end(); return { ok: false as const, reason: 'bad-code' as const }; }
    const customerId = rows[0].id;

    const open = await sql`select id, code_hash, attempts
      from customer_password_resets
      where customer_id=${customerId} and used_at is null and expires_at > now()
      order by created_at desc limit 1`;
    if (!open.length) { await sql.end(); return { ok: false as const, reason: 'expired' as const }; }
    const row = open[0];
    if (Number(row.attempts) >= 5) {
      await sql`update customer_password_resets set used_at=now() where id=${row.id}`;
      await sql.end();
      return { ok: false as const, reason: 'too-many-tries' as const };
    }

    const [salt, expected] = String(row.code_hash).split(':');
    if (!safeEqualHex(hashCode(code, salt), expected)) {
      await sql`update customer_password_resets set attempts=attempts+1 where id=${row.id}`;
      await sql.end();
      return { ok: false as const, reason: 'bad-code' as const };
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const hash = newSalt + ':' + crypto.scryptSync(newPassword, newSalt, 64).toString('hex');
    await sql.begin(async (tx) => {
      await tx`update customers set password_hash=${hash} where id=${customerId}`;
      await tx`delete from customer_sessions where customer_id=${customerId}`;
      await tx`update customer_password_resets set used_at=now() where customer_id=${customerId} and used_at is null`;
      await tx`insert into shop_events (customer_id, kind, detail) values (${customerId}, 'password-reset', 'reset by email code')`;
    });
    await sql.end();
    return { ok: true as const };
  } catch {
    try { if (sql) await sql.end(); } catch {}
    return { ok: false as const, reason: 'error' as const };
  }
}
