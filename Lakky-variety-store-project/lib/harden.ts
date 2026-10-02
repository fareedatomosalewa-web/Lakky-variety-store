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
// Rate-limit order lookups: max 10 per minute per phone (free, in-memory)
const hits = new Map<string, number[]>();
export function lookupAllowed(phone: string): boolean {
  const now = Date.now();
  const arr = (hits.get(phone) || []).filter(t => now - t < 60000);
  if (arr.length >= 10) return false;
  arr.push(now); hits.set(phone, arr);
  return true;
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
