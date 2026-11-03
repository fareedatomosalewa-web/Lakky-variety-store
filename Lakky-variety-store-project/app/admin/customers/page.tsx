'use client';
import { useEffect, useRef, useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { listCustomersFull, exportCustomersCsv, listEvents, getCustomerDetail, resetCustomerPassword, updateCustomerContact } from '../../../lib/shop-v1';

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
  const [detail, setDetail] = useState<any>(null);
  const [detailMsg, setDetailMsg] = useState('');
  const [pw, setPw] = useState('');
  const [edit, setEdit] = useState({ email: '', phone: '' });
  const req = useRef(0);

  const load = async (term = search) => {
    setLoading(true);
    const r: any = await listCustomersFull({ search: term }).catch(() => null);
    setLoading(false);
    if (r && r.ok) { setRows(r.rows); setTotal(r.total); setMsg(''); }
    else setMsg('Could not load customers. Please try again.');
  };
  const loadEvents = async () => {
    const e: any = await listEvents().catch(() => null);
    if (e && e.ok) setEvents(e.rows);
  };

  useEffect(() => { if (allowed) { load(''); loadEvents(); } }, [allowed]);

  const open = async (c: any) => {
    if (openId === c.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(c.id);
    setDetail({ loading: true });
    setDetailMsg('');
    setEdit({ email: c.email || '', phone: c.phone || '' });
    setPw('');
    const mine = ++req.current;
    const r: any = await getCustomerDetail({ customerId: c.id }).catch(() => null);
    if (mine !== req.current) return;
    if (r && r.ok) setDetail(r);
    else { setDetail(null); setDetailMsg('Could not load this customer. Nothing has changed. Try Manage again.'); }
  };

  const refreshDetail = async (id: number) => {
    const r: any = await getCustomerDetail({ customerId: id }).catch(() => null);
    if (r && r.ok) setDetail(r);
  };

  const saveContact = async (id: number) => {
    const r: any = await updateCustomerContact({ customerId: id, email: edit.email, phone: edit.phone }).catch(() => null);
    if (!r || !r.ok) {
      setDetailMsg(r?.reason === 'email-used' ? 'That email belongs to another customer.'
        : r?.reason === 'phone-used' ? 'That phone belongs to another customer.'
        : r?.reason === 'bad-email' ? 'That email does not look right.'
        : r?.reason === 'email-required' ? 'Please enter an email address.'
        : r?.reason === 'bad-phone' ? 'Phone must have at least 8 digits.' : 'Could not save. Please try again.');
      return;
    }
    setDetailMsg('Contact updated. The customer logs in with the new email.');
    await load();
    await refreshDetail(id);
  };

  const resetPw = async (id: number) => {
    const v = pw.trim();
    if (v.length < 6) { setDetailMsg('New password must be 6+ characters.'); return; }
    const r: any = await resetCustomerPassword({ customerId: id, newPassword: v }).catch(() => null);
    setDetailMsg(r && r.ok ? 'Password reset. Old sessions signed out. Give the new password to the customer yourself.' : 'Reset failed — nothing changed. Try again.');
    if (r && r.ok) { setPw(''); loadEvents(); }
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

  const c = detail && !detail.loading ? detail.customer : null;
  const cOrders = (detail && detail.orders) || [];
  const cPending = (detail && detail.pending) || [];

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

    {openId !== null && (<div className="card" style={{ marginTop: 10, borderColor: 'var(--plum)' }}>
      {detail?.loading && <div><b>Loading customer…</b><div className="small">Reading their details and orders from Supabase.</div></div>}
      {!detail?.loading && c && (<>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, flex: 1 }}>{c.name}</h3>
          <button className="btn-s" onClick={() => { setOpenId(null); setDetail(null); }}>Close</button>
        </div>
        <div style={{ marginTop: 8 }}><b>Phone:</b> {c.phone || '—'} · <b>Email:</b> {c.email || '—'}</div>
        <div className="small" style={{ marginTop: 4 }}>Joined {day(c.joined)} · <b>{cOrders.length}</b> order(s) · store credit <b>₦{Number(c.credit || 0).toLocaleString()}</b></div>

        <div style={{ marginTop: 12 }}><b>Orders</b></div>
        {cOrders.length === 0 && cPending.length === 0 && <div className="small">No orders yet.</div>}
        {cOrders.map((o: any) => <div key={`o-${o.id}`} className="small" style={{ marginTop: 2 }}>
          <a href={`/admin/orders/${encodeURIComponent(o.displayId || o.id)}`} style={{ textDecoration: 'underline' }}>{o.displayId || `#${o.id}`}</a>
          {' '}· ₦{Number(o.total || 0).toLocaleString()} · {o.status || '—'} · {day(o.at)}
        </div>)}
        {cPending.map((o: any) => <div key={`p-${o.id}`} className="small" style={{ marginTop: 2 }}>
          <a href={`/admin/orders/${encodeURIComponent(o.displayId || o.id)}`} style={{ textDecoration: 'underline' }}>{o.displayId}</a>
          {' '}· ₦{Number(o.total || 0).toLocaleString()} · {o.status} (not confirmed yet) · {day(o.at)}
        </div>)}

        <div style={{ marginTop: 12 }}><b>Correct email / phone</b></div>
        <div className="small">Email and phone each stay unique. The customer logs in with the new email.</div>
        <input placeholder="Email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
        <input placeholder="Phone, like +234…" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
        <button className="btn-s" onClick={() => saveContact(c.id)}>Save contact</button>

        <div style={{ marginTop: 14 }}><b>Set a new password</b></div>
        <div className="small">Use this only when the customer cannot use the email reset. Old sessions are signed out. This is the customer password — the owner/admin password is never changed here.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="password" placeholder="New password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: 220 }} />
          <button className="btn-s" onClick={() => resetPw(c.id)}>Reset customer password</button>
        </div>
        {detailMsg && <div className="small" style={{ marginTop: 8, fontWeight: 700 }}>{detailMsg}</div>}
      </>)}
      {!detail?.loading && !c && <div><b>Could not load this customer.</b><div className="small">{detailMsg || 'Nothing has changed.'}</div><div style={{ marginTop: 8 }}><button className="btn-s" onClick={() => { const row = rows.find((x) => x.id === openId); if (row) open(row); }}>Try again</button></div></div>}
    </div>)}

    <div className="tablewrap">
      <table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th><th>Orders</th><th></th></tr></thead>
        <tbody>
          {rows.map((row: any) => (<tr key={row.id}>
            <td data-th="Name">{row.name}</td>
            <td data-th="Phone">{row.phone}</td>
            <td data-th="Email">{row.email || '—'}</td>
            <td data-th="Joined">{day(row.joined)}</td>
            <td data-th="Orders">{Number(row.orders || 0)}</td>
            <td data-th=""><button className="btn-s" onClick={() => open(row)}>{openId === row.id ? 'Close' : 'Manage'}</button></td>
          </tr>))}
          {!rows.length && <tr><td colSpan={6} className="small">No customers match that search.</td></tr>}
        </tbody>
      </table>
    </div>

    <div className="card" style={{ marginTop: 10 }}><h3 style={{ marginTop: 0 }}>Activity — who did what</h3>
      {events.length === 0 && <div className="small">Nothing logged yet.</div>}
      {events.map((e: any, i: number) => <div key={i} className="small">{String(e.at).slice(0, 16)} · order {e.orderId || '—'} · {e.actor} · {e.action} {e.note}</div>)}
    </div>
  </div>);
}
