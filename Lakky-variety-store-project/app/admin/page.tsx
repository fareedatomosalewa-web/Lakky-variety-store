'use client';
import { useEffect, useState } from 'react';
import { useAdminGuard } from '../../lib/use-admin-guard';
import { listPending, listConfirmed, adminSearch, setProgress, dashboard, exportCsv, remindersDue, listFees, agedStockpile, releaseStockpile, rejectPending } from '../../lib/shop-v1';
import { confirmOrder } from '../../lib/shop-actions';
const NEXTS: Record<string, string> = { pending: 'confirmed', confirmed: 'packaged', packaged: 'onway', onway: 'ready', ready: 'completed' };
export default function AdminDash() {
  const allowed = useAdminGuard(['admin', 'staff']);
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [q, setQ] = useState(''); const [found, setFound] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [remind, setRemind] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [aged, setAged] = useState<any[]>([]);
  const [pop, setPop] = useState<any>(null);
  const [popMsg, setPopMsg] = useState('');
  const [popReason, setPopReason] = useState('Underpayment');
  const [tab, setTab] = useState('pending');
  const [confirmed, setConfirmed] = useState<any[]>([]);
  const load = async () => {
    const r: any = await listPending().catch(() => null);
    if (r && r.ok) setItems(r.rows);
    const c: any = await listConfirmed().catch(() => null);
    if (c && c.ok) setConfirmed(c.rows);
    const d: any = await dashboard().catch(() => null);
    if (d && d.ok) setStats(d);
    const rm: any = await remindersDue().catch(() => null);
    if (rm && rm.ok) setRemind(rm.due);
    const f: any = await listFees({}).catch(() => null);
    if (f && f.ok) setFees(f.rows);
    const ag: any = await agedStockpile().catch(() => null);
    if (ag && ag.ok) setAged(ag.aged);
  };
  useEffect(() => { if (allowed) load(); }, [allowed]);
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const bulk = async (to: string) => {
    if (!sel.length) return;
    const ids = sel.filter((id) => items.find((i) => i.id === id));
    await setProgress({ ids, to, actor: 'owner' }).catch(() => null);
    setSel([]); load();
  };
  const search = async () => {
    const r: any = await adminSearch({ q }).catch(() => null);
    if (r && r.ok) setFound(r.rows);
  };
  const csv = async (what: string) => {
    const r: any = await exportCsv({ what }).catch(() => null);
    if (r && r.ok && r.csv) {
      const blob = new Blob([r.csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = what + '.csv'; a.click();
    }
  };
  return (<div><h2>Admin queue — all pending first</h2>
    {stats && <div className="card small">Today sales ₦{Number(stats.salesToday).toLocaleString()} • open orders {stats.openOrders} • stockpiled {stats.stockpiled} • store credit owed ₦{Number(stats.creditOwed).toLocaleString()}</div>}
    <div><a href="/admin/products">Products</a> | <a href="/admin/settings">Settings / Business Rules</a> | <a href="/admin/reports">Reports + CSV</a> | <a href="/admin/customers">Customers + activity</a> | <a href="/admin/staff">Staff</a></div>
    <div className="card"><b>Search</b> by Order ID, Reference ID, name or phone<div style={{ display: 'flex', gap: 8 }}><input placeholder="LVS-… / REF-… / name / phone" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-s" onClick={search}>Search</button></div>
      {found.map((o) => <div key={o.id} className="small"><a href={`/admin/orders/${o.referenceId || o.displayId}`}>{o.displayId}</a> • {o.name} • {o.phone} • {o.pay} • {o.st}</div>)}</div>
    <div className="card"><b>Bulk progress ({sel.length} picked)</b><div>{['packaged', 'onway', 'ready', 'completed'].map((t) => <button key={t} className="btn-s" style={{ marginRight: 6 }} onClick={() => bulk(t)}>→ {t}</button>)}</div></div>
    {items.length === 0 && tab === 'pending' && <div className="card">No pending proofs yet. Submit one via storefront Pay page.</div>}
    <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
      {(['pending', 'under', 'confirmed'] as string[]).map((t) => <button key={t} className="btn-s" style={tab === t ? { background: '#5A2948', color: '#fff' } : undefined} onClick={() => setTab(t)}>{t === 'pending' ? 'Pending' : t === 'under' ? 'Under' : 'Confirmed'}</button>)}
    </div>
    {(tab === 'pending' ? items.filter((o) => o.status === 'pending') : tab === 'under' ? items.filter((o) => o.status !== 'pending') : confirmed).map((o) => <div className="card" key={o.id || o.displayId}><input type="checkbox" checked={sel.includes(o.id)} onChange={() => toggle(o.id)} /> <b>{o.referenceId || o.ref || o.displayId}</b> • {o.name} • {o.phone} • Expected ₦{Number(o.total).toLocaleString()} • Got ₦{Number(o.submitted || o.paid || 0).toLocaleString()} <span className="badge">{o.status || o.st}</span><br /><button className="btn-s" onClick={() => { setPop({ mode: 'confirm', ref: o.referenceId || o.ref || o.displayId }); setPopMsg(''); }}>Confirm</button> <button className="btn-d" onClick={() => { setPop({ mode: 'reject', ref: o.referenceId || o.ref || o.displayId }); setPopMsg(''); }}>Reject</button> <a className="btn" href={`/admin/orders/${o.referenceId || o.ref || o.displayId}`}>Open →</a></div>)}
    {pop && (<div className="card"><h3>{pop.mode === 'confirm' ? 'Have you seen this payment in our bank?' : 'Reject this order?'}</h3>
      {pop.mode === 'reject' && <div><select value={popReason} onChange={(e) => setPopReason(e.target.value)}>{['Underpayment', 'Fake receipt', 'Wrong order'].map((r) => <option key={r} value={r}>{r}</option>)}</select></div>}
      <div><b>{popMsg}</b></div>
      <button className="btn" onClick={async () => {
        if (pop.mode === 'confirm') {
          const it = items.find((x) => (x.referenceId || x.ref) === pop.ref);
          if (Number(it.submitted || 0) < Number(it.total || 0)) { setPopMsg('Underpaid — open the order instead.'); return; }
          const r: any = await confirmOrder({ pendingRef: pop.ref, verifiedAmount: Number(it.submitted), seenBank: true }).catch(() => null);
          if (r && r.ok) { setPop(null); load(); } else setPopMsg('Not saved — ' + ((r && r.reason) || 'try again') + '. Nothing changed.');
        } else {
          const r: any = await rejectPending({ ref: pop.ref, reason: popReason, admin: 'owner' }).catch(() => null);
          if (r && r.ok) { setPop(null); load(); } else setPopMsg('Could not reject. Try again.');
        }
      }}>Yes</button> <button className="btn-s" onClick={() => setPop(null)}>Back</button></div>)}
    <div className="card"><b>Exports</b> <button className="btn-s" onClick={() => csv('orders')}>Orders CSV</button> <button className="btn-s" onClick={() => csv('customers')}>Customers CSV</button></div>
    {remind.length > 0 && <div className="card"><b>Not-completed reminders due ({remind.length})</b>{remind.map((o: any) => <div key={o.id} className="small">{o.displayId} • {o.st} — remind customer + owner</div>)}</div>}
    {fees.length > 0 && <div className="card"><b>Stockpile fee payments ({fees.length})</b>{fees.slice(0, 20).map((f: any) => <div key={f.id} className="small">#{f.id} {f.displayId} ₦{Number(f.amount).toLocaleString()} [{f.status}]</div>)}</div>}
    {aged.length > 0 && <div className="card"><b>Past max stockpile days ({aged.length}) — contact first, then release</b>{aged.map((o: any) => <div key={o.id} className="small">{o.displayId} • {o.name} • uncollected {o.days} days (max {o.maxd}) <button className="btn-d" onClick={async () => { await releaseStockpile({ orderId: o.id, actor: 'owner' }); load(); }}>Release to stock</button></div>)}</div>}
  </div>);
}
