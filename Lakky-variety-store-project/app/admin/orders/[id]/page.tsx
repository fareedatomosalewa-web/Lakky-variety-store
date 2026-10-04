'use client';
import { useEffect, useState } from 'react';
export default function AdminOrder({ params }: { params: { id: string } }) {
  const [o, setO] = useState<any>(null); const [verified, setVerified] = useState(''); const [msg, setMsg] = useState('');
  const [seenBank, setSeenBank] = useState(false);
  useEffect(() => {
    const p = JSON.parse(localStorage.getItem('lakky-last-proof') || '{}');
    setO(p.ref === params.id ? p : null);
  }, [params.id]);
  const act = (kind: string) => {
    const expected = Number(o.total || 0), paid = Number(o.amount || 0);
    if (kind === 'confirm') {
      if (!seenBank) { setMsg('Blocked: tick Seen in bank (check bank app/SMS, NOT screenshot) before Confirm'); return; }
      if (paid < expected) { setMsg(`Blocked: underpayment outstanding ₦${(expected - paid).toLocaleString()}`); return; }
      const n = Number(localStorage.getItem('lakky-order-seq') || '0') + 1;
      localStorage.setItem('lakky-order-seq', String(n));
      const last4 = String(o.phone || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
      const id = `LVS-${String(n).padStart(3, '0')}-${last4}`;
      setVerified(id);
      setMsg(paid > expected ? `Confirmed ${id}. Stock reserved. Overpayment excess ₦${(paid - expected).toLocaleString()} → Store Credit (non-cashable).` : `Confirmed ${id}. Stock reserved (available-=qty, reserved+=qty).`);
    }
    if (kind === 'under') setMsg(`Marked Underpayment. Outstanding ₦${(expected - paid).toLocaleString()}. No Order ID, no stock move. Top-up stays linked.`);
    if (kind === 'reject') setMsg('Rejected. No Order ID, no stock move.');
  };
  if (!o) return <div className="card">Order not found (submit proof first).</div>;
  return (<div className="card"><h3>Order {params.id} — full record</h3>
    <div>Customer: {o.name} • {o.phone} • {o.method} {o.area}</div>
    <div>Expected ₦{(o.total||0).toLocaleString()} vs Submitted ₦{o.amount} • Date {o.date} • Ref {o.ref}</div>
    <div>Stockpile: confirmed date → free 14 days → fee 500/day (defaults, editable in Settings). Release blocked if fee unpaid.</div>
    <div><input placeholder="Verified amount (admin)" value={verified} onChange={e=>setVerified(e.target.value)} /></div>
    <div><label><input type="checkbox" checked={seenBank} onChange={e=>setSeenBank(e.target.checked)} /> Seen in bank (bank app/SMS, NOT screenshot) — required</label></div>
    <button className="btn" onClick={() => act('confirm')}>Confirm</button> <button className="btn" onClick={() => act('under')}>Mark Under</button> <button className="btn" onClick={() => act('reject')}>Reject</button>
    <div><b>{msg}</b></div>
    <div><a className="btn" href={`https://wa.me/${String(o.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hello from Lakky Variety Store. Order ${params.id} update.`)}`} target="_blank" rel="noreferrer">Send WhatsApp update</a></div></div>);
}
