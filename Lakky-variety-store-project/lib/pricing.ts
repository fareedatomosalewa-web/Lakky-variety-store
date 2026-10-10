// Pure pricing + code helpers — NO "use server" here (imported by pages AND actions).
const REFCHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeRef(): string {
  const b = new Uint8Array(6);
  (globalThis.crypto as Crypto).getRandomValues(b);
  let s = 'REF-';
  for (let i = 0; i < 6; i++) s += REFCHARS[b[i] % REFCHARS.length];
  return s;
}
export function discountFor(p: any, now = new Date()) {
  if (!p || !p.discount_value) return null;
  if (p.discount_start && new Date(p.discount_start) > now) return null;
  if (p.discount_end && new Date(p.discount_end) < now) return null;
  const off = p.discount_type === 'percent'
    ? Math.round((p.basePrice * Number(p.discount_value)) / 100)
    : Number(p.discount_value);
  return { off, price: Math.max(0, p.basePrice - off), label: p.discount_type === 'percent' ? `${p.discount_value}% off` : `₦${Number(p.discount_value).toLocaleString()} off` };
}
export function tierPrice(tiers: any, qty: number, base: number): number {
  try {
    const list = (typeof tiers === 'string' ? JSON.parse(tiers) : tiers) || [];
    let price = base;
    for (const t of list) if (qty >= Number(t.min) && (t.max === undefined || t.max === null || qty <= Number(t.max))) price = Number(t.each);
    return price;
  } catch { return base; }
}
export function isNew(p: any, days = 7): boolean {
  if (!p) return false;
  if (p.badge === 'NEW') return true;
  if (!p.created_at) return false;
  return (Date.now() - new Date(p.created_at).getTime()) / 86400000 <= days;
}
export function isRestocked(p: any, days = 2): boolean {
  if (!p) return false;
  if (p.status === 'Restocked') return true;
  if (!p.restocked_at) return false;
  return (Date.now() - new Date(p.restocked_at).getTime()) / 86400000 <= days;
}
