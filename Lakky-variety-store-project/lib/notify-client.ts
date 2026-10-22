'use client';
// Small browser-notification + in-app toast helpers. Safe everywhere: if the
// browser cannot do notifications, the in-app toast still appears.

export function toast(message: string) {
  try { window.dispatchEvent(new CustomEvent('lakky-toast', { detail: String(message).slice(0, 300) })); } catch { /* ignore */ }
}

export function notifyMe(title: string, body: string) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body: String(body).slice(0, 160), icon: '/icon-192.png', tag: 'lakky-message' });
    }
  } catch { /* ignore */ }
}

export function askNotifyPermission() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('unsupported');
    if (Notification.permission === 'granted') return Promise.resolve('granted');
    return Notification.requestPermission();
  } catch { return Promise.resolve('unsupported'); }
}

export function notifySupported() {
  try { return typeof window !== 'undefined' && 'Notification' in window; } catch { return false; }
}
