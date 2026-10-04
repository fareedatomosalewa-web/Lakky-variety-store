// Pure phone helpers — NO "use server" line here on purpose.
// Imported by server actions and anywhere else. Behavior identical everywhere.
export function normalizePhone(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('234')) return '+' + d;
  if (d.startsWith('0')) return '+234' + d.slice(1);
  return '+' + d;
}
export function last4(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
}
