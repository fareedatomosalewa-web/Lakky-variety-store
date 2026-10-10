'use client';
import { useEffect, useState } from 'react';
import { canConfirm } from '../../../../lib/domain';
import { confirmOrder, getSubmissionProof } from '../../../../lib/shop-actions';
import { useAdminGuard } from '../../../../lib/use-admin-guard';
import { getOrderThread, getPendingDetail, listFees, listRefunds, decideRefund, markFeePaid, markPartial, postMessage, rejectPending } from '../../../../lib/shop-v1';
const REJECTS = ['Underpayment', 'Fake receipt', 'Wrong order', 'Other'];
export default function AdminOrder({ params }: { params: { id: string } }) {
  const allowed = useAdminGuard();
  const [o, setO] = useState<any>(null); const [verified, setVerified] = useState(''); const [msg, setMsg] = useState('');
  const [seenBank, setSeenBank] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [live, setLive] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [reply, setReply] = useState('');
  const [reason, setReason] = useState(REJECTS[0]); const [note, setNote] = useState('');
  const [refunds, setRefunds] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  useEffect(() => {
    const p = JSON.parse(localStorage.getItem('lakky-last-proof') || '{}');
    setO(p.ref === params.id ? p : null);
    getSubmissionProof({ ref: params.id }).then((r: any) => { if (r && r.ok && r.url) setProofUrl(r.url); }).catch(() => {});
    getPendingDetail({ ref: params.id }).then((r: any) => { if (r && r.ok) setLive(r); }).catch(() => {});
    getOrderThread({ ref: params.id }).then((r: any) => { if (r && r.ok) { setOrderId(r.orderId); setMsgs(r.messages || []); if (r.orderId) listFees({ orderId: r.orderId }).then((f: any) => { if (f && f.ok) setFees(f.rows); }).catch(() => {}); } }).catch(() => {});
    listRefunds({}).then((r: any) => { if (r && r.ok) setRefunds(r.rows); }).catch(() => {});
  }, [params.id]);
  const reloadMsgs = async () => { const r: any = await getOrderThread({ ref: params.id }).catch(() => null); if (r && r.ok) { setOrderId(r.orderId); setMsgs(r.messages || []); } };
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
    if (kind === 'reject') {
      const r: any = await rejectPending({ ref: params.id, reason, note, admin: 'owner' }).catch(() => null);
      setMsg(r && r.ok ? `Rejected (${reason}). Customer sees the reason.` : 'Rejected. No Order ID, no stock move.');
    }
    if (kind === 'partial') {
      const r: any = await markPartial({ ref: params.id, note: note || 'Some items unavailable', admin: 'owner' }).catch(() => null);
      setMsg(r && r.ok ? 'Marked partially accepted. Customer chooses: credit, refund, or cancel.' : 'Could not mark partial.');
    }
  };
  const sendReply = async () => {
    if (!reply.trim() || !orderId) return;
    await postMessage({ orderId, sender: 'owner', text: reply }).catch(() => null);
    setReply(''); reloadMsgs();
  };
  const fee = async (kind: string) => {
    if (!orderId) { setMsg('Confirm the order first, then mark fees.'); return; }
    await markFeePaid({ orderId, kind, admin: 'owner' }).catch(() => null);
    setMsg(kind === 'delivery' ? 'Delivery fee marked paid.' : 'Stockpile fee marked paid.');
  };
  if (!o) return <div className="card">Order not found (submit proof first).</div>;
  if (!allowed) return <div className="card">Checking admin session…</div>;
  return (<div><div className="card"><h2>Order {params.id} — full record</h2>
    <div>Customer: {o.name} • {o.phone} • {o.method} {o.area}</div>
    <div>Expected ₦{(o.total||0).toLocaleString()} vs Submitted ₦{o.amount} • Date {o.date} • Ref {o.ref}{live && live.pending && live.pending.reference_id ? ` • ${live.pending.reference_id}` : ''}</div>
    {live && live.submissions && live.submissions.length > 0 && <div className="small">Submitted amounts: {live.submissions.map((s: any) => `₦${Number(s.amountClaimed).toLocaleString()}`).join(' + ')}{live.submissions[live.submissions.length - 1].reference ? ` • bank ref: ${live.submissions[live.submissions.length - 1].reference}` : ''}</div>}
    <div>Stockpile: confirmed date → free days → daily fee (live Settings). Release blocked if fee unpaid.</div>
    {proofUrl ? <div><div className="small">Customer receipt:</div><img src={proofUrl} alt="payment receipt" style={{ maxWidth: '100%', borderRadius: 10 }} /></div> : null}
    <div><input placeholder="Verified amount (admin — from bank app, not screenshot)" value={verified} onChange={e=>setVerified(e.target.value)} /></div>
    <div><label><input type="checkbox" checked={seenBank} onChange={e=>setSeenBank(e.target.checked)} /> Seen in bank (bank app/SMS, NOT screenshot) — required</label></div>
    <button className="btn" onClick={() => act('confirm')}>Accept</button> <button className="btn" onClick={() => act('under')}>Mark Under</button> <button className="btn-s" onClick={() => act('partial')}>Partially accept</button>
    <div style={{ marginTop: 8 }}><b>Reject with reason</b> <select value={reason} onChange={(e) => setReason(e.target.value)}>{REJECTS.map((r) => <option key={r} value={r}>{r}</option>)}</select> <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} /> <button className="btn-d" onClick={() => act('reject')}>Reject</button></div>
    <div style={{ marginTop: 8 }}><button className="btn-s" onClick={() => fee('delivery')}>Delivery fee paid</button> <button className="btn-s" onClick={() => fee('stockpile')}>Stockpile fee paid</button></div>
    <div><b>{msg}</b></div>
    <div><a className="btn" href={`https://wa.me/${String(o.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hello from Lakky Variety Store. Order ${params.id} update.`)}`} target="_blank" rel="noreferrer">Send WhatsApp update</a></div></div>
    <div className="card"><h3>Messages</h3>
      {!orderId && <div className="small">Confirm the order to open its message thread.</div>}
      {msgs.map((m, i) => <div key={i} className="small"><b>{m.sender}:</b> {m.text}</div>)}
      <div style={{ display: 'flex', gap: 8 }}><input placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} /><button className="btn-s" onClick={sendReply}>Send</button></div></div>
    <div className="card"><h3>Fee payments</h3>
      {fees.length === 0 && <div className="small">None recorded for this order.</div>}
      {fees.map((f: any) => <div key={f.id} className="small">#{f.id} ₦{Number(f.amount).toLocaleString()} [{f.status}] by {f.verified_by || 'owner'}</div>)}
    </div>
    <div className="card"><h3>Refund / credit requests</h3>
      {refunds.length === 0 && <div className="small">None pending.</div>}
      {refunds.map((r) => <div key={r.id} className="small">#{r.id} {r.kind} ₦{Number(r.amount).toLocaleString()} {r.bank_name} {r.account_number} {r.account_name} [{r.status}] <button className="btn-s" onClick={async () => { await decideRefund({ id: r.id, approve: true, admin: 'owner' }); setRefunds(refunds.filter((x) => x.id !== r.id)); }}>Approve</button> <button className="btn-d" onClick={async () => { await decideRefund({ id: r.id, approve: false, admin: 'owner' }); setRefunds(refunds.filter((x) => x.id !== r.id)); }}>Decline</button></div>)}
    </div></div>);
}
