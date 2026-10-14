'use server';

// Owner phone alerts: Web Push to subscribed devices + in-app banner data.
// If VAPID keys are missing (owner hasn't pasted them yet), sending is a
// silent no-op — the badge + banner still work, nothing breaks.
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

async function requireOwner(): Promise<boolean> {
  try {
    const { getAdminSession } = await import('./auth');
    const s = await getAdminSession();
    return !!s.ok;
  } catch {
    return true;
  }
}

export async function pushReady() {
  return { ok: true as const, ready: !!vapid(), publicKey: vapid()?.pub || null };
}

// Owner taps "Notify me" on her phone: store this device (one row per phone).
export async function savePushSubscription(args: { endpoint: string; p256dh: string; auth: string }) {
  try {
    if (!(await requireOwner())) return { ok: false as const };
    if (!args.endpoint || !args.p256dh || !args.auth) return { ok: false as const };
    const sql = conn();
    await sql`insert into push_subscriptions (endpoint, p256dh, auth) values (${args.endpoint}, ${args.p256dh}, ${args.auth}) on conflict (endpoint) do update set p256dh=${args.p256dh}, auth=${args.auth}`;
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}

// Buzz every subscribed owner phone. Never throws into order flows.
export async function sendAdminPush(args: { title: string; body: string; url: string }) {
  try {
    const v = vapid();
    if (!v) return { ok: false as const, reason: 'no-keys' };
    const sql = conn();
    const subs = await sql`select endpoint, p256dh as "p256dh", auth from push_subscriptions`;
    if (!subs.length) { await sql.end(); return { ok: false as const, reason: 'no-devices' }; }
    webpush.setVapidDetails(v.subj, v.pub, v.priv);
    const payload = JSON.stringify({ title: args.title, body: args.body.slice(0, 140), url: args.url });
    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (e: any) {
        // Dead subscription (app removed): drop it quietly.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          try { await sql`delete from push_subscriptions where endpoint=${s.endpoint}`; } catch { /* keep going */ }
        }
      }
    }
    await sql.end();
    return { ok: true as const };
  } catch { return { ok: false as const }; }
}
