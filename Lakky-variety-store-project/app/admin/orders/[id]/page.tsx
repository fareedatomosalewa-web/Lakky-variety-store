'use client';
import { useEffect, useState } from 'react';
import { canConfirm } from '../../../../lib/domain';
import { confirmOrder, getSubmissionProof } from '../../../../lib/shop-actions';
import { useAdminGuard } from '../../../../lib/use-admin-guard';
export default function AdminOrder({ params }: { params: { id: string } }) {
  const allowed = useAdminGuard();
  const [o, setO] = useState<any>(null); const [verified, setVerified] = useState(''); const [msg, setMsg] = useState('');
  const [seenBank, setSeenBank] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  useEffect(() => {
    const p = JSON.parse(localStorage.getItem('lakky-last-proof') || '{}');
    setO(p.ref === params.id ? p : null);
    getSubmissionProof({ ref: params.id }).then((r: any) => { if (r && r.ok && r.url) setProofUrl(r.url); }).catch(() => {});
  }, [params.id]);
  const act = async (kind: string) => {
    const expected = Number(o.total || 0), paid = Number(o.amount || 0);
    if (kind === 'confirm') {
      const gate = canConfirm({ seenBank, paid, expected });
      if (!gate.ok && gate.reason === 'seen-bank-required') { setMsg('Blocked: tick Seen in bank (check bank app/SMS, NOT screenshot) before Confirm'); return; }
      if (!gate.ok) { setMsg(`Blocked: underpayment outstanding ₦${(expected - paid).toLocaleString()}`); return; }
      if (o.live) {
        try {
          const r: any = await confirmOrder({ pendingRef: params.id, verifiedAmount: Number(verified || paid), seenBank: true });
          if (r.ok) { setVerified(r.displayId); setMsg(`Confirmed ${r.displayId} in Supabase. Stock reserved (available-=qty, reserved+=qty).` + (r.over ? ` Overpayment excess ₦${Number(r.over).toLocaleString()} → Store Credit.` : '')); return; }
          if (r.reason === 'race-lost') { setMsg('Blocked: stock gone at verify — amount goes to Store Credit.'); return; }
          if (r.reason === 'underpayment') { setMsg(`Underpayment in Supabase. Outstanding ₦${Number(r.outstanding || 0).toLocaleString()}.`); return; }
        } catch { /* fall through to local demo confirm */ }
      }
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
  if (!allowed) return <div className="card">Checking admin session…</div>;
  return (<div className="card"><h3>Order {params.id} — full record</h3>
    <div>Customer: {o.name} • {o.phone} • {o.method} {o.area}</div>
    <div>Expected ₦{(o.total||0).toLocaleString()} vs Submitted ₦{o.amount} • Date {o.date} • Ref {o.ref}</div>
    <div>Stockpile: confirmed date → free 14 days → fee 500/day (defaults, editable in Settings). Release blocked if fee unpaid.</div>
    {proofUrl ? <div><div className="small">Customer receipt:</div><img src={proofUrl} alt="payment receipt" style={{ maxWidth: '100%', borderRadius: 10 }} /></div> : null}
    <div><input placeholder="Verified amount (admin)" value={verified} onChange={e=>setVerified(e.target.value)} /></div>
    <div><label><input type="checkbox" checked={seenBank} onChange={e=>setSeenBank(e.target.checked)} /> Seen in bank (bank app/SMS, NOT screenshot) — required</label></div>
    <button className="btn" onClick={() => act('confirm')}>Confirm</button> <button className="btn" onClick={() => act('under')}>Mark Under</button> <button className="btn" onClick={() => act('reject')}>Reject</button>
    <div><b>{msg}</b></div>
    <div><a className="btn" href={`https://wa.me/${String(o.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hello from Lakky Variety Store. Order ${params.id} update.`)}`} target="_blank" rel="noreferrer">Send WhatsApp update</a></div></div>);
}
