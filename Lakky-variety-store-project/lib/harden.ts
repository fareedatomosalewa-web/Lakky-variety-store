export type Notice = { id: string; type: string; message: string; at: string; read?: boolean };
const KEY = 'lakky-notices';
export function pushNotice(type: string, message: string) {
  const list: Notice[] = JSON.parse(localStorage.getItem(KEY) || '[]');
  list.unshift({ id: `${Date.now()}`, type, message, at: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}
export function readNotices(): Notice[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
// Rate-limit order lookups: v1.2 = 5 wrong tries / hour / IP → lock 1 hr (free, in-memory)
// Key = IP (caller passes IP; phone-based helper kept for backwards compat).
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_TRIES = 5;
function trackHit(key: string, now = Date.now()): { allowed: boolean; remaining: number } {
  const arr = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= MAX_TRIES) return { allowed: false, remaining: 0 };
  arr.push(now); hits.set(key, arr);
  return { allowed: true, remaining: MAX_TRIES - arr.length };
}
export function trackAllowedByIP(ip: string, now = Date.now()): boolean {
  return trackHit(`ip:${ip}`, now).allowed;
}
export function lookupAllowed(phone: string): boolean {
  // Backwards compat: old callers pass phone; enforce same 5/hour rule per key.
  return trackHit(`phone:${phone}`).allowed;
}
export function last4Match(phone: string, last4: string): boolean {
  const d = (phone || '').replace(/\D/g, '');
  return d.slice(-4) === (last4 || '').replace(/\D/g, '');
}
export function normalizeNG(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('234')) return '+' + d;
  if (d.startsWith('0')) return '+234' + d.slice(1);
  return phone;
}
export function validNG(phone: string): boolean {
  return /^\+234[789][01]\d{8}$/.test(normalizeNG(phone));
}
