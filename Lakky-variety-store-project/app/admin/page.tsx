'use client';
import { useEffect, useState } from 'react';
import { useAdminGuard } from '../../lib/use-admin-guard';
import { listPending, listConfirmed, adminSearch, setProgress, dashboard, exportCsv, remindersDue, listFees, agedStockpile, releaseStockpile, rejectPending, sweepUnpaid } from '../../lib/shop-v1';
import { confirmOrder } from '../../lib/shop-actions';
import AdminShell from './shell';
const ago = (d: any) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
};
const mask = (p: string) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 7) return p;
  return `${d.slice(0, 4)} •••• ${d.slice(-4)}`;
};
export default function AdminDash() {
  const allowed = useAdminGuard(['admin', 'staff']);
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [q, setQ] = useState(''); const [found, setFound] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [remind, setRemind] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [aged, setAged] = useState<any[]>([]);
  const [confirmed, setConfirmed] = useState<any[]>([]);
  const [tab, setTab] = useState('review');
  const [pop, setPop] = useState<any>(null);
  const [bulkAsk, setBulkAsk] = useState('');
  const [popMsg, setPopMsg] = useState('');
  const [popReason, setPopReason] = useState('Underpayment');
  const [bulkMsg, setBulkMsg] = useState('');
  const bulkApply = async () => {
    const refs = sel.map((id) => { const it = items.find((x) => x.id === id); return it ? (it.referenceId || it.ref) : null; }).filter(Boolean) as string[];
    let ok = 0, fail = 0;
    if (bulkAsk.startsWith('Confirm')) {
      for (const ref of refs) {
        const it = items.find((x) => (x.referenceId || x.ref) === ref);
        const r: any = await confirmOrder({ pendingRef: ref, verifiedAmount: Number(it.submitted || 0), seenBank: true }).catch(() => null);
        if (r && r.ok) ok++; else fail++;
      }
    } else {
      for (const ref of refs) {
        const r: any = await rejectPending({ ref, reason: popReason, admin: 'owner' }).catch(() => null);
        if (r && r.ok) ok++; else fail++;
      }
    }
    setBulkMsg(`Done: ${ok} applied, ${fail} skipped.`);
    setBulkAsk(''); setSel([]); load();
  };
  const load = async () => {
    await sweepUnpaid().catch(() => null);
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
    await setProgress({ ids: sel, to, actor: 'owner' }).catch(() => null);
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
  const review = items.filter((o) => o.status === 'pending');
  const under = items.filter((o) => o.status !== 'pending');
  const week = confirmed.filter((o) => Date.now() - new Date(o.at || Date.now()).getTime() < 7 * 86400000);
  const received = week.reduce((s, o) => s + Number(o.total || 0), 0);
  const rows = tab === 'review' ? review : tab === 'under' ? under : tab === 'confirmed' ? confirmed : tab === 'ready' ? confirmed.filter((o) => o.st === 'ready' || o.st === 'onway') : confirmed.filter((o) => o.st === 'rejected' || o.st === 'cancelled');
  const quick = async () => {
    if (!pop) return;
    if (pop.mode === 'confirm') {
      const it = items.find((x) => (x.referenceId || x.ref) === pop.ref);
      if (!it || Number(it.submitted || 0) < Number(it.total || 0)) { setPopMsg('Underpaid — open the order instead.'); return; }
      const r: any = await confirmOrder({ pendingRef: pop.ref, verifiedAmount: Number(it.submitted), seenBank: true }).catch(() => null);
      if (r && r.ok) { setPop(null); load(); } else setPopMsg('Not saved — ' + ((r && r.reason) || 'try again') + '. Nothing changed.');
    } else {
      const r: any = await rejectPending({ ref: pop.ref, reason: popReason, admin: 'owner' }).catch(() => null);
      if (r && r.ok) { setPop(null); load(); } else setPopMsg('Could not reject. Try again.');
    }
  };
  return (<AdminShell><h2>Orders</h2>
    <div className="searchbar"><span aria-hidden="true">🔍</span><input placeholder="Ref, name, phone or last 4…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} /><button className="btn-s" onClick={search}>Go</button></div>
    {found.length > 0 && <div className="card">{found.map((o) => <div key={o.id} className="small"><a href={`/admin/orders/${o.referenceId || o.displayId}`}>{o.displayId}</a> • {o.name} • {o.phone} • {o.pay} • {o.st}</div>)}</div>}
    <div className="sumgrid">
      <div className="sumcard"><div className="t">TO REVIEW</div><div className="n" style={{ color: '#B7791F' }}>{review.length}</div></div>
      <div className="sumcard"><div className="t">UNDERPAID</div><div className="n" style={{ color: 'var(--red)' }}>{under.length}</div></div>
      <div className="sumcard"><div className="t">CONFIRMED THIS WEEK</div><div className="n" style={{ color: 'var(--green)' }}>{week.length}</div></div>
      <div className="sumcard"><div className="t">RECEIVED THIS WEEK</div><div className="n">₦{received.toLocaleString()}</div></div>
    </div>
    <div className="catchips" style={{ marginTop: 10 }}>
      {[['review', `To review (${review.length})`], ['under', `Underpaid (${under.length})`], ['confirmed', 'Confirmed'], ['ready', 'Ready'], ['rejected', 'Rejected']].map(([t, label]) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>)}
    </div>
    <div className="tablewrap"><table>
      <thead><tr><th></th><th>REF</th><th>CUSTOMER</th><th>SUBMITTED</th><th>EXPECTED</th><th>CLAIMED</th><th>RECEIPT</th><th>STATUS</th><th></th></tr></thead>
      <tbody>{rows.map((o) => <tr key={o.id || o.displayId}>
        <td data-th="Pick"><input type="checkbox" checked={sel.includes(o.id)} onChange={() => toggle(o.id)} /></td>
        <td data-th="Ref"><b>{o.referenceId || o.ref || o.displayId}</b></td>
        <td data-th="Customer">{o.name}<br /><span className="mask">{mask(o.phone)}</span>{o.method ? ` · ${o.method}` : ''}</td>
        <td data-th="Submitted">{o.at ? ago(o.at) : '—'}</td>
        <td data-th="Expected">₦{Number(o.total).toLocaleString()}</td>
        <td data-th="Claimed" style={Number(o.submitted || o.paid || 0) < Number(o.total) ? { color: 'var(--red)', fontWeight: 700 } : undefined}>₦{Number(o.submitted || o.paid || 0).toLocaleString()}</td>
        <td data-th="Receipt">{o.hasReceipt ? '🧾 Yes' : '—'}</td>
        <td data-th="Status"><span className="badge">{o.status || o.st}</span></td>
        <td data-th="Open"><a className="btn" style={{ textDecoration: 'none', padding: '8px 14px', minHeight: 0 }} href={`/admin/orders/${o.referenceId || o.ref || o.displayId}`}>Review</a> <button className="btn-s" onClick={() => { setPop({ mode: 'confirm', ref: o.referenceId || o.ref }); setPopMsg(''); }}>✓</button> <button className="btn-d" onClick={() => { setPop({ mode: 'reject', ref: o.referenceId || o.ref }); setPopMsg(''); }}>✕</button></td>
      </tr>)}</tbody>
    </table></div>
    {rows.length === 0 && <div className="empty">Nothing here.</div>}
    {pop && (<div className="card"><h3>{pop.mode === 'confirm' ? 'Have you seen this payment in our bank?' : 'Reject this order?'}</h3>
      {pop.mode === 'reject' && <div><select value={popReason} onChange={(e) => setPopReason(e.target.value)}>{['Underpayment', 'Fake receipt', 'Wrong order'].map((r) => <option key={r} value={r}>{r}</option>)}</select></div>}
      <div><b>{popMsg}</b></div>
      <button className="btn" onClick={quick}>Yes</button> <button className="btn-s" onClick={() => setPop(null)}>Back</button></div>)}
    <div className="card"><b>Bulk ({sel.length} picked): progress</b><div>{['packaged', 'onway', 'ready', 'completed'].map((t) => <button key={t} className="btn-s" style={{ marginRight: 6 }} onClick={() => bulk(t)}>→ {t}</button>)}</div>
      <div style={{ marginTop: 8 }}><b>Bulk decide (pending only):</b> {bulkAsk ? (<span>{bulkAsk} <button className="btn" onClick={bulkApply}>Yes, apply</button> <button className="btn-s" onClick={() => setBulkAsk('')}>Back</button></span>) : (<span><button className="btn-s" onClick={() => setBulkAsk(`Confirm ${sel.length} orders?`)}>Confirm picked</button> <button className="btn-d" onClick={() => setBulkAsk(`Reject ${sel.length} orders?`)}>Reject picked</button></span>)}</div>
      {bulkMsg && <div><b>{bulkMsg}</b></div>}</div>
    {stats && <div className="card small">Today sales ₦{Number(stats.salesToday).toLocaleString()} • open orders {stats.openOrders} • stockpiled {stats.stockpiled} • store credit owed ₦{Number(stats.creditOwed).toLocaleString()} • <button className="btn-s" onClick={() => csv('orders')}>Orders CSV</button> <button className="btn-s" onClick={() => csv('customers')}>Customers CSV</button></div>}
    {remind.length > 0 && <div className="card"><b>Not-completed reminders due ({remind.length})</b>{remind.map((o: any) => <div key={o.id} className="small">{o.displayId} • {o.st} — remind customer + owner</div>)}</div>}
    {aged.length > 0 && <div className="card"><b>Past max stockpile days ({aged.length}) — contact first, then release</b>{aged.map((o: any) => <div key={o.id} className="small">{o.displayId} • {o.name} • uncollected {o.days} days (max {o.maxd}) <button className="btn-d" onClick={async () => { const { releaseStockpile } = await import('../../lib/shop-v1'); await releaseStockpile({ orderId: o.id, actor: 'owner' }); load(); }}>Release to stock</button></div>)}</div>}
  </AdminShell>);
}
