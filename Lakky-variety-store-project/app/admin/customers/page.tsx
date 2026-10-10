'use client';
import { useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { listCustomers, listEvents, resetCustomerPassword } from '../../../lib/shop-v1';
export default function CustomersPage() {
  const allowed = useAdminGuard();
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [pw, setPw] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const load = async () => {
    const r: any = await listCustomers().catch(() => null);
    if (r && r.ok) setRows(r.rows);
    const e: any = await listEvents().catch(() => null);
    if (e && e.ok) setEvents(e.rows);
  };
  const reset = async (id: number) => {
    const v = (pw[id] || '').trim();
    if (v.length < 6) { setMsg('New password must be 6+ characters.'); return; }
    const r: any = await resetCustomerPassword({ customerId: id, newPassword: v }).catch(() => null);
    setMsg(r && r.ok ? 'Password reset. Old sessions signed out.' : 'Reset failed.');
    setPw({ ...pw, [id]: '' });
  };
  return (<div><h2>Customers</h2>
    <div className="card"><button className="btn-s" onClick={load}>Load customers + activity</button> <span className="small">{msg}</span>
      {rows.map((c: any) => <div key={c.id} className="small"><b>{c.name}</b> • {c.phone} • {c.email || 'no email'} • credit ₦{Number(c.credit || 0).toLocaleString()} <input type="password" placeholder="New password" value={pw[c.id] || ''} onChange={(e) => setPw({ ...pw, [c.id]: e.target.value })} style={{ width: 160 }} /> <button className="btn-s" onClick={() => reset(c.id)}>Reset password</button></div>)}</div>
    <div className="card"><h3>Activity — who did what</h3>
      {events.length === 0 && <div className="small">Nothing logged yet.</div>}
      {events.map((e: any, i: number) => <div key={i} className="small">{String(e.at).slice(0, 16)} • order {e.orderId || '—'} • {e.actor} • {e.action} {e.note}</div>)}</div></div>);
}
