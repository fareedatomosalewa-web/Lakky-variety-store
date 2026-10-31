'use client';
import { useEffect, useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { listCustomersFull, exportCustomersCsv, listEvents, resetCustomerPassword, updateCustomerContact } from '../../../lib/shop-v1';

const day = (v: any) => (v ? String(v).slice(0, 10) : 'Before tracking');

export default function CustomersPage() {
  const allowed = useAdminGuard();
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [pw, setPw] = useState('');
  const [edit, setEdit] = useState({ email: '', phone: '' });

  const load = async (term = search) => {
    setLoading(true);
    const r: any = await listCustomersFull({ search: term }).catch(() => null);
    setLoading(false);
    if (r && r.ok) { setRows(r.rows); setTotal(r.total); }
    else setMsg('Could not load customers. Please try again.');
  };
  const loadEvents = async () => {
    const e: any = await listEvents().catch(() => null);
    if (e && e.ok) setEvents(e.rows);
  };

  useEffect(() => { if (allowed) { load(''); loadEvents(); } }, [allowed]);

  const open = (c: any) => {
    setOpenId(openId === c.id ? null : c.id);
    setEdit({ email: c.email || '', phone: c.phone || '' });
    setPw(''); setMsg('');
  };

  const saveContact = async (id: number) => {
    const r: any = await updateCustomerContact({ customerId: id, email: edit.email, phone: edit.phone }).catch(() => null);
    if (!r || !r.ok) {
      setMsg(r?.reason === 'email-used' ? 'That email belongs to another customer.'
        : r?.reason === 'phone-used' ? 'That phone belongs to another customer.'
        : r?.reason === 'bad-email' ? 'That email does not look right.'
        : r?.reason === 'email-required' ? 'Please enter an email address.'
        : r?.reason === 'bad-phone' ? 'Phone must have at least 8 digits.' : 'Could not save. Please try again.');
      return;
    }
    setMsg('Contact updated. The customer logs in with the new email.');
    load();
  };

  const resetPw = async (id: number) => {
    const v = pw.trim();
    if (v.length < 6) { setMsg('New password must be 6+ characters.'); return; }
    const r: any = await resetCustomerPassword({ customerId: id, newPassword: v }).catch(() => null);
    setMsg(r && r.ok ? 'Password reset. Old sessions signed out.' : 'Reset failed.');
    setPw('');
  };

  const download = async () => {
    const r: any = await exportCustomersCsv().catch(() => null);
    if (!r || !r.ok || !r.csv) { setMsg('Could not build the spreadsheet. Please try again.'); return; }
    const blob = new Blob(['\ufeff' + r.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lakky-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (!allowed) return <div className="card">Checking admin session…</div>;

  const shown = rows.find((c) => c.id === openId);

  return (<div><h2>Customers</h2>
    <div className="card">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search name, phone or email" value={search} style={{ flex: '1 1 220px', margin: 0 }}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }} />
        <button className="btn-s" onClick={() => load()} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        <button className="btn-s" onClick={() => { setSearch(''); load(''); }}>Clear</button>
        <button className="btn" onClick={download}>Download spreadsheet (CSV)</button>
      </div>
      <div className="small" style={{ marginTop: 8 }}>{loading ? 'Loading…' : `Showing ${rows.length} of ${total} customers.`}</div>
      {msg && <div className="notice-err" style={{ whiteSpace: 'normal', marginTop: 8 }}>{msg}</div>}
    </div>

    <div className="tablewrap">
      <table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th><th>Orders</th><th></th></tr></thead>
        <tbody>
          {rows.map((c: any) => (<tr key={c.id}>
            <td data-th="Name">{c.name}</td>
            <td data-th="Phone">{c.phone}</td>
            <td data-th="Email">{c.email || '—'}</td>
            <td data-th="Joined">{day(c.joined)}</td>
            <td data-th="Orders">{Number(c.orders || 0)}</td>
            <td data-th=""><button className="btn-s" onClick={() => open(c)}>{openId === c.id ? 'Close' : 'Manage'}</button></td>
          </tr>))}
          {!rows.length && <tr><td colSpan={6} className="small">No customers match that search.</td></tr>}
        </tbody>
      </table>
    </div>

    {shown && (<div className="card" style={{ marginTop: 10 }}>
      <h3 style={{ marginTop: 0 }}>{shown.name}</h3>
      <div className="small">Joined {day(shown.joined)} · {Number(shown.orders || 0)} order(s) · credit ₦{Number(shown.credit || 0).toLocaleString()}</div>
      <div style={{ marginTop: 10 }}><b>Correct email / phone</b></div>
      <div className="small">Email and phone each stay unique. The customer logs in with the new email.</div>
      <input placeholder="Email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
      <input placeholder="Phone, like +234…" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
      <button className="btn-s" onClick={() => saveContact(shown.id)}>Save contact</button>

      <div style={{ marginTop: 14 }}><b>Set a new password</b></div>
      <div className="small">Use this only when the customer cannot use the email reset. Old sessions are signed out.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: 200 }} />
        <button className="btn-s" onClick={() => resetPw(shown.id)}>Reset password</button>
      </div>
    </div>)}

    <div className="card" style={{ marginTop: 10 }}><h3 style={{ marginTop: 0 }}>Activity — who did what</h3>
      {events.length === 0 && <div className="small">Nothing logged yet.</div>}
      {events.map((e: any, i: number) => <div key={i} className="small">{String(e.at).slice(0, 16)} · order {e.orderId || '—'} · {e.actor} · {e.action} {e.note}</div>)}
    </div>
  </div>);
}
