'use client';
import { useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { reportRange } from '../../../lib/shop-v1';
export default function ReportsPage() {
  const allowed = useAdminGuard();
  const [from, setFrom] = useState('2026-09-01'); const [to, setTo] = useState('2026-09-30');
  const [sum, setSum] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const run = async () => {
    const r: any = await reportRange({ from, to }).catch(() => null);
    if (r && r.ok) { setSum(r.summary); setRows(r.rows); }
  };
  const csv = () => {
    if (!rows.length) return;
    const head = 'order,total,paid,status,fulfilment';
    const body = rows.map((o: any) => `${o.id},${o.total},${o.paid},${o.pay},${o.st}`).join('\n');
    const blob = new Blob([head + '\n' + body + '\n'], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report-${from}-to-${to}.csv`; a.click();
  };
  return (<div className="card"><h2>Reports</h2>
    <div className="small">Pick a start and end date. Works for any past date, years later.</div>
    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
    <div><button className="btn" onClick={run}>Show report</button> <button className="btn-s" onClick={csv}>Export CSV</button></div>
    {sum && (<div style={{ marginTop: 10 }}>
      <div><b>Orders placed: {sum.placed}</b></div>
      <div>Approved: {sum.approved} • Rejected/cancelled: {sum.rejected}</div>
      <div>Underpaid: {sum.under} • Overpaid: {sum.over}</div>
      <div>Pickup: {sum.pickup} • Delivery: {sum.delivery} • Still kept with us: {sum.stockpiled}</div>
      <div><b>Money received: ₦{Number(sum.money).toLocaleString()}</b></div>
    </div>)}
    {rows.length > 0 && (<div style={{ marginTop: 10 }}><b>Orders in this time:</b>
      {rows.map((o: any) => <div key={o.id} className="small">{o.id} — ₦{Number(o.paid).toLocaleString()} of ₦{Number(o.total).toLocaleString()} — {o.pay}, {o.st}</div>)}
    </div>)}
    <div className="small">Records are kept forever. Nothing is ever deleted.</div></div>);
}
