'use client';
import { useEffect, useState } from 'react';
import { useAdminGuard } from '../../lib/use-admin-guard';
import { listPending, adminSearch, setProgress, dashboard, exportCsv, remindersDue, listFees } from '../../lib/shop-v1';
const NEXTS: Record<string, string> = { pending: 'confirmed', confirmed: 'packaged', packaged: 'onway', onway: 'ready', ready: 'completed' };
export default function AdminDash() {
  const allowed = useAdminGuard();
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [q, setQ] = useState(''); const [found, setFound] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [remind, setRemind] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const load = async () => {
    const r: any = await listPending().catch(() => null);
    if (r && r.ok) setItems(r.rows);
    const d: any = await dashboard().catch(() => null);
    if (d && d.ok) setStats(d);
    const rm: any = await remindersDue().catch(() => null);
    if (rm && rm.ok) setRemind(rm.due);
    const f: any = await listFees({}).catch(() => null);
    if (f && f.ok) setFees(f.rows);
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
    <div><a href="/admin/products">Products</a> | <a href="/admin/settings">Settings / Business Rules</a> | <a href="/admin/reports">Reports + CSV</a></div>
    <div className="card"><b>Search</b> by Order ID, Reference ID, name or phone<div style={{ display: 'flex', gap: 8 }}><input placeholder="LVS-… / REF-… / name / phone" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-s" onClick={search}>Search</button></div>
      {found.map((o) => <div key={o.id} className="small"><a href={`/admin/orders/${o.referenceId || o.displayId}`}>{o.displayId}</a> • {o.name} • {o.phone} • {o.pay} • {o.st}</div>)}</div>
    <div className="card"><b>Bulk progress ({sel.length} picked)</b><div>{['packaged', 'onway', 'ready', 'completed'].map((t) => <button key={t} className="btn-s" style={{ marginRight: 6 }} onClick={() => bulk(t)}>→ {t}</button>)}</div></div>
    {items.length === 0 && <div className="card">No pending proofs yet. Submit one via storefront Pay page.</div>}
    {items.map((o) => <div className="card" key={o.id}><input type="checkbox" checked={sel.includes(o.id)} onChange={() => toggle(o.id)} /> <b>{o.ref}</b>{o.referenceId ? ` • ${o.referenceId}` : ''} • {o.name} • {o.phone} • Expected ₦{Number(o.total).toLocaleString()} <span className="badge">{o.status}</span><br /><a className="btn" href={`/admin/orders/${o.ref}`}>Open order detail →</a></div>)}
    <div className="card"><b>Exports</b> <button className="btn-s" onClick={() => csv('orders')}>Orders CSV</button> <button className="btn-s" onClick={() => csv('customers')}>Customers CSV</button></div>
    {remind.length > 0 && <div className="card"><b>Not-completed reminders due ({remind.length})</b>{remind.map((o: any) => <div key={o.id} className="small">{o.displayId} • {o.st} — remind customer + owner</div>)}</div>}
    {fees.length > 0 && <div className="card"><b>Stockpile fee payments ({fees.length})</b>{fees.slice(0, 20).map((f: any) => <div key={f.id} className="small">#{f.id} {f.displayId} ₦{Number(f.amount).toLocaleString()} [{f.status}]</div>)}</div>}
  </div>);
}
