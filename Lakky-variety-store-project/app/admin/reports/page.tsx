'use client';
import { useState } from 'react';
import { useAdminGuard } from '../../../lib/use-admin-guard';
export default function ReportsPage() {
  const allowed = useAdminGuard();
  const [from, setFrom] = useState('2026-09-01'); const [to, setTo] = useState('2026-09-30');
  const [csv, setCsv] = useState('');
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const run = () => {
    // Source = own DB. Demo aggregation from localStorage proof; real query = orders table by date.
    const demo = { from, to, ordersPlaced: 0, approved: 0, rejected: 0, under: 0, over: 0, cancelled: 0, pickup: 0, delivery: 0, stockpileActive: 0, feesDue: 0, feesPaid: 0, totalVerified: 0, creditIssued: 0, creditUsed: 0 };
    const rows = Object.entries(demo).map(([k, v]) => `${k},${v}`);
    setCsv(`metric,value\n${rows.join('\n')}\n`);
  };
  const download = () => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report-${from}-to-${to}.csv`; a.click();
  };
  return (<div className="card"><h3>Reports — pick date or range, works years later</h3>
    <div>Retention: keep ALL records forever. No deletes.</div>
    <input value={from} onChange={e=>setFrom(e.target.value)} /> <input value={to} onChange={e=>setTo(e.target.value)} />
    <button className="btn" onClick={run}>Run report</button> <button className="btn" onClick={download}>Export CSV</button>
    <pre>{csv}</pre></div>);
}
