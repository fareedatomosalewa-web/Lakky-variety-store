'use server';

// Customer phone notifications (Web Push).
//
// A customer taps "Allow" (right after signup or later in settings). The phone
// gives us a private subscription address; we store it in
// customer_push_subscriptions and use it to send order updates.
//
// Rules:
//  - A subscription only works for the account that saved it (we check the
//    customer's login token before saving or deleting).
//  - Dead subscriptions (app removed / permission revoked) are deleted quietly.
//  - If VAPID keys or any subscription are missing, sending is a silent no-op
//    so ordering never breaks.
import postgres from 'postgres';
import webpush from 'web-push';

function conn() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('no-db');
  return postgres(url, { prepare: false });
}

function vapid(): { pub: string; priv: string; subj: string } | null {
  const pub = process.env.VAPID_PUBLIC_KEY || '';
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  if (!pub || !priv) return null;
  return { pub, priv, subj: process.env.VAPID_SUBJECT || 'mailto:owner@lakky.store' };
}

async function customerIdFromToken(sql: any, token: string): Promise<number | null> {
  const t = String(token || '');
  if (!t) return null;
  const rows = await sql`select customer_id as cid from customer_sessions
    where id=${t} and expires_at > now() limit 1`;
  return rows.length ? rows[0].cid : null;
}

// Tells the page whether phone notifications can work at all on this host.
export async function customerPushReady() {
  const v = vapid();
  return { ok: true as const, ready: !!v, publicKey: v?.pub || null };
}

// Save (or refresh) this phone for this customer.
export async function saveCustomerPush(args: {
  token: string; endpoint: string; p256dh: string; auth: string; userAgent?: string;
}) {
  let sql;
  try {
    const endpoint = String(args.endpoint || '').slice(0, 2000);
    const p256dh = String(args.p256dh || '').slice(0, 500);
    const auth = String(args.auth || '').slice(0, 500);
    if (!endpoint || !p256dh || !auth) return { ok: false as const, reason: 'missing' };
    sql = conn();
    const cid = await customerIdFromToken(sql, args.token);
    if (!cid) { await sql.end(); return { ok: false as const, reason: 'login' }; }
    await sql`insert into customer_push_subscriptions (customer_id, endpoint, p256dh, auth, user_agent)
      values (${cid}, ${endpoint}, ${p256dh}, ${auth}, ${String(args.userAgent || '').slice(0, 300)})
      on conflict (endpoint) do update set
        customer_id = excluded.customer_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent`;
    await sql.end();
    return { ok: true as const };
  } catch {
    try { if (sql) await sql.end(); } catch {}
    return { ok: false as const, reason: 'error' };
  }
}

// Switch phone notifications off for this phone.
export async function removeCustomerPush(args: { token: string; endpoint: string }) {
  let sql;
  try {
    sql = conn();
    const cid = await customerIdFromToken(sql, args.token);
    if (!cid) { await sql.end(); return { ok: false as const, reason: 'login' }; }
    await sql`delete from customer_push_subscriptions
      where customer_id=${cid} and endpoint=${String(args.endpoint || '')}`;
    await sql.end();
    return { ok: true as const };
  } catch {
    try { if (sql) await sql.end(); } catch {}
    return { ok: false as const, reason: 'error' };
  }
}

// Used by the settings page to show On / Off for this device.
export async function customerPushStatus(args: { token: string }) {
  let sql;
  try {
    sql = conn();
    const cid = await customerIdFromToken(sql, args.token);
    if (!cid) { await sql.end(); return { ok: false as const, enabled: false, ready: !!vapid() }; }
    const n = await sql`select count(*)::int n from customer_push_subscriptions where customer_id=${cid}`;
    await sql.end();
    return { ok: true as const, enabled: n[0].n > 0, ready: !!vapid() };
  } catch {
    try { if (sql) await sql.end(); } catch {}
    return { ok: false as const, enabled: false, ready: !!vapid() };
  }
}

// Send one phone notification to every phone this customer has switched on.
// Server-only helper (not called from the browser).
export async function sendCustomerPush(args: {
  customerId: number; title: string; body: string; url?: string;
}) {
  let sql;
  try {
    const v = vapid();
    if (!v) return { ok: false as const, reason: 'no-keys' };
    if (!args.customerId) return { ok: false as const, reason: 'no-customer' };
    sql = conn();
    const subs = await sql`select endpoint, p256dh, auth from customer_push_subscriptions
      where customer_id=${args.customerId}`;
    if (!subs.length) { await sql.end(); return { ok: false as const, reason: 'no-devices' }; }
    webpush.setVapidDetails(v.subj, v.pub, v.priv);
    const payload = JSON.stringify({
      title: String(args.title || 'Lakky Variety Store').slice(0, 80),
      body: String(args.body || '').slice(0, 150),
      url: args.url || '/orders',
    });
    let sent = 0;
    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e: any) {
        // 404/410 = phone removed the app or revoked permission.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          try { await sql`delete from customer_push_subscriptions where endpoint=${s.endpoint}`; } catch {}
        }
      }
    }
    await sql.end();
    return { ok: sent > 0, sent };
  } catch {
    try { if (sql) await sql.end(); } catch {}
    return { ok: false as const, reason: 'error' };
  }
}
