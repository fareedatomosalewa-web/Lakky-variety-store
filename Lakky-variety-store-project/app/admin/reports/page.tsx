'use client';
import { useEffect, useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { reportRange } from '../../../lib/shop-v1';
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
export default function ReportsPage() {
  const allowed = useAdminGuard();
  const [from, setFrom] = useState(() => daysAgo(30)); const [to, setTo] = useState(today);
  const [sum, setSum] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('placed');
  const [err, setErr] = useState('');
  const run = async (f = from, t = to) => {
    setErr('');
    const r: any = await reportRange({ from: f, to: t }).catch(() => null);
    if (r && r.ok) { setSum(r.summary); setRows(r.rows); }
    else setErr('Could not load the report. Check the dates and try again.');
  };
  useEffect(() => { if (allowed) run(); }, [allowed]);
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const match = (o: any, f: string) => {
    if (f === 'all') return true;
    if (f === 'placed') return o.kind === 'order';
    if (f === 'approved') return o.kind === 'order' && (o.pay === 'confirmed' || o.pay === 'overpayment');
    if (f === 'rejected') return (o.kind === 'order' && o.st === 'cancelled') || (o.kind === 'pending' && o.st === 'rejected');
    if (f === 'under') return (o.kind === 'order' && o.pay === 'underpayment') || (o.kind === 'pending' && o.st === 'under');
    if (f === 'over') return o.kind === 'order' && o.pay === 'overpayment';
    if (f === 'money') return o.kind === 'order' && Number(o.paid) > 0;
    if (f === 'pickup') return o.kind === 'order' && o.method === 'Pickup';
    if (f === 'delivery') return o.kind === 'order' && o.method === 'Delivery';
    if (f === 'stockpiled') return o.kind === 'order' && o.stock === 'held';
    return true;
  };
  const list = rows.filter((o) => match(o, filter));
  const card = (key: string, label: string, value: any, tone?: string) => (
    <button onClick={() => setFilter(key)} className="sumcard" aria-pressed={filter === key} style={{ textAlign: 'left', cursor: 'pointer', border: filter === key ? '2px solid var(--plum)' : '1px solid var(--line)', background: filter === key ? '#FBF3EE' : '#fff' }}>
      <div className="t">{label}</div><div className="n" style={{ color: tone }}>{value}</div>
    </button>
  );
  const csv = () => {
    if (!list.length) return;
    const head = 'order,total,paid,status,fulfilment,method';
    const body = list.map((o: any) => `${o.id},${o.total},${o.paid},${o.pay},${o.st},${o.method || ''}`).join('\n');
    const blob = new Blob([head + '\n' + body + '\n'], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report-${from}-to-${to}-${filter}.csv`; a.click();
  };
  return (<div>
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Reports</h2>
      <div className="small">Pick a start and end date. Works for any past date, years later.</div>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <div><button className="btn" onClick={() => run()}>Show report</button> <button className="btn-s" onClick={csv} disabled={!list.length}>Export CSV</button></div>
      {err && <div className="notice-err" style={{ marginTop: 8 }}>{err}</div>}
      {sum && (<div className="grid-cards" style={{ marginTop: 10 }}>
        {card('placed', 'ORDERS PLACED', sum.placed)}
        {card('approved', 'APPROVED', sum.approved, 'var(--green)')}
        {card('rejected', 'REJECTED / CANCELLED', sum.rejected, 'var(--red)')}
        {card('under', 'UNDERPAID', sum.under, 'var(--red)')}
        {card('over', 'OVERPAID', sum.over)}
        {card('money', 'MONEY RECEIVED', `₦${Number(sum.money).toLocaleString()}`, 'var(--green)')}
        {card('pickup', 'PICKUP', sum.pickup)}
        {card('delivery', 'DELIVERY', sum.delivery)}
        {card('stockpiled', 'KEPT WITH US', sum.stockpiled)}
        {card('all', 'ALL LINES', rows.length)}
      </div>)}
      {sum && <div className="small" style={{ marginTop: 8, whiteSpace: 'normal' }}>
        <b>Why Orders and Reports can look different:</b> both now count <b>money received</b> (what you actually got paid), not what the customer was expected to pay. Orders shows the <b>last 7 days</b>; Reports shows <b>the two dates you pick</b>. A payment that landed outside your report dates will show in one and not the other. Tap any card above to see exactly which orders make up that number.
      </div>}
    </div>
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Orders — {filter === 'money' ? 'money received' : filter}</h3>
        <span className="small">{list.length} showing</span>
      </div>
      {rows.length === 0 && <div className="small" style={{ marginTop: 8 }}>No orders or rejected/underpaid submissions in these dates.</div>}
      {list.map((o: any, i: number) => (
        <div key={`${o.kind}-${o.id}-${i}`} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            {o.kind === 'order'
              ? <a href={`/admin/orders/${encodeURIComponent(o.id)}`} style={{ fontWeight: 700 }}>{o.id} ›</a>
              : <span><b>{o.id}</b> <span className="badge badge-err">not confirmed</span></span>}
            <span className="small">{o.name || 'Customer'} • {o.phone || ''}</span>
          </div>
          <div className="small">₦{Number(o.paid).toLocaleString()} received of ₦{Number(o.total).toLocaleString()} • {o.pay} • {o.st}{o.method ? ` • ${o.method}` : ''}</div>
        </div>
      ))}
      <div className="small" style={{ marginTop: 10 }}>Records are kept forever. Nothing is ever deleted.</div>
    </div>
  </div>);
}
