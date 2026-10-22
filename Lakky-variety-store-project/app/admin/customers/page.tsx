'use client';
import { useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { listCustomers, listEvents, resetCustomerPassword, updateCustomerContact } from '../../../lib/shop-v1';
export default function CustomersPage() {
  const allowed = useAdminGuard();
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [pw, setPw] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ email: '', phone: '' });
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
  const startEdit = (c: any) => { setEditId(c.id); setEdit({ email: c.email || '', phone: c.phone || '' }); setMsg(''); };
  const save = async (id: number) => {
    const r: any = await updateCustomerContact({ customerId: id, email: edit.email, phone: edit.phone }).catch(() => null);
    if (!r || !r.ok) {
      setMsg(r?.reason === 'email-used' ? 'That email belongs to another customer.' : r?.reason === 'phone-used' ? 'That phone belongs to another customer.' : r?.reason === 'bad-email' ? 'That email does not look right.' : r?.reason === 'email-required' ? 'Please enter an email address.' : r?.reason === 'bad-phone' ? 'Phone must have at least 8 digits.' : 'Could not save. Please try again.');
      return;
    }
    setEditId(null); setMsg('Contact updated. The customer logs in with the new email.');
    load();
  };
  return (<div><h2>Customers</h2>
    <div className="card">
      <button className="btn-s" onClick={load}>Refresh customers + activity</button> <span className="small">{msg}</span>
      {rows.length === 0 && <div className="small" style={{ marginTop: 8 }}>Tap Refresh to load.</div>}
      {rows.map((c: any) => (<div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div><b>{c.name}</b> <span className="small">• {c.phone} • {c.email || 'no email'} • credit ₦{Number(c.credit || 0).toLocaleString()}</span></div>
          {editId !== c.id && <button className="btn-s" onClick={() => startEdit(c)}>Edit email / phone</button>}
        </div>
        {editId === c.id && (<div className="card" style={{ marginTop: 8 }}>
          <div className="small">Correct the customer’s contact. Email and phone each stay unique.</div>
          <input placeholder="Email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
          <input placeholder="Phone, like +234…" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}><button className="btn-s" onClick={() => save(c.id)}>Save</button><button className="btn-s" onClick={() => setEditId(null)}>Cancel</button></div>
        </div>)}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <input type="password" placeholder="New password" value={pw[c.id] || ''} onChange={(e) => setPw({ ...pw, [c.id]: e.target.value })} style={{ width: 160 }} />
          <button className="btn-s" onClick={() => reset(c.id)}>Reset password</button>
          <span className="small">Use this when a customer with no email/password cannot log in.</span>
        </div>
      </div>))}
    </div>
    <div className="card"><h3 style={{ marginTop: 0 }}>Activity — who did what</h3>
      {events.length === 0 && <div className="small">Nothing logged yet.</div>}
      {events.map((e: any, i: number) => <div key={i} className="small">{String(e.at).slice(0, 16)} • order {e.orderId || '—'} • {e.actor} • {e.action} {e.note}</div>)}</div>
  </div>);
}
