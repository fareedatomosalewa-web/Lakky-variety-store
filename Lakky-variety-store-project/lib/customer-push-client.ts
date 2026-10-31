'use client';
// Browser helpers for customer phone notifications. Safe to call on every
// device: if the browser cannot do push, the shop still works normally.
import { customerPushReady, saveCustomerPush, removeCustomerPush } from './customer-push';

export function pushSupported(): boolean {
  try {
    return typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
  } catch {
    return false;
  }
}

export function permissionState(): string {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

function keyToBytes(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const regs = await navigator.serviceWorker.getRegistrations();
  if (!regs.length) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function currentEndpoint(): Promise<string | null> {
  try {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    const sub = await reg.pushManager.getSubscription();
    return sub ? sub.endpoint : null;
  } catch {
    return null;
  }
}

// Ask the browser, subscribe this phone, and save it to the customer account.
export async function subscribeThisDevice(token: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!pushSupported()) return { ok: false, reason: 'unsupported' };
    if (!token) return { ok: false, reason: 'login' };
    const ready: any = await customerPushReady().catch(() => null);
    if (!ready || !ready.ready || !ready.publicKey) return { ok: false, reason: 'not-configured' };

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: perm };

    const reg = await registration();
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(String(ready.publicKey)),
    });
    const j: any = sub.toJSON();
    const saved: any = await saveCustomerPush({
      token,
      endpoint: sub.endpoint,
      p256dh: j?.keys?.p256dh || '',
      auth: j?.keys?.auth || '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }).catch(() => null);
    if (!saved || !saved.ok) return { ok: false, reason: saved?.reason || 'save-failed' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function unsubscribeThisDevice(token: string): Promise<{ ok: boolean }> {
  try {
    if (!pushSupported()) return { ok: true };
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return { ok: true };
    await removeCustomerPush({ token, endpoint: sub.endpoint }).catch(() => null);
    await sub.unsubscribe().catch(() => null);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
