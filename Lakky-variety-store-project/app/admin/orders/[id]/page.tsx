'use client';
import { useEffect, useState } from 'react';
import { confirmOrder, getSubmissionProof } from '../../../../lib/shop-actions';
import { useAdminGuard } from '../../../../lib/use-admin-guard';
import { getOrderThread, getPendingDetail, listFees, listRefunds, decideRefund, markFeePaid, postMessage, rejectPending, advanceOrder, underPending } from '../../../../lib/shop-v1';
import { stepLabel } from '../../../../lib/pricing';
const REJECTS = ['Underpayment', 'Fake receipt', 'Wrong order'];
export default function AdminOrder({ params }: { params: { id: string } }) {
  const allowed = useAdminGuard(['admin', 'staff']);
  const [o, setO] = useState<any>(null); const [verified, setVerified] = useState(''); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
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
    getPendingDetail({ ref: params.id }).then((r: any) => {
      if (r && r.ok) {
        const pd = r.pending;
        setLive(r);
        setO({
          ref: pd.ref, referenceId: pd.reference_id, total: pd.expected_total,
          amount: r.submissions.length ? r.submissions[r.submissions.length - 1].amountClaimed : pd.expected_total,
          name: pd.name, phone: pd.phone, method: (pd.fulfilment || {}).method, area: (pd.fulfilment || {}).area,
          date: String(pd.created_at || '').slice(0, 10), live: true,
        });
      } else {
        setO(null);
      }
    }).catch(() => setO(null));
    getSubmissionProof({ ref: params.id }).then((r: any) => { if (r && r.ok && r.url) setProofUrl(r.url); }).catch(() => {});
    getOrderThread({ ref: params.id }).then((r: any) => { if (r && r.ok) { setOrderId(r.orderId); setMsgs(r.messages || []); if (r.status) setCurStatus(r.status); if (r.orderId) listFees({ orderId: r.orderId }).then((f: any) => { if (f && f.ok) setFees(f.rows); }).catch(() => {}); } }).catch(() => {});
    listRefunds({}).then((r: any) => { if (r && r.ok) setRefunds(r.rows); }).catch(() => {});
  }, [params.id]);
  const reloadMsgs = async () => { const r: any = await getOrderThread({ ref: params.id }).catch(() => null); if (r && r.ok) { setOrderId(r.orderId); setMsgs(r.messages || []); if (r.status) setCurStatus(r.status); } };
  const act = async (kind: string) => {
    if (busy) return;
    const expected = Number(o.total || 0), paid = Number(o.amount || 0);
    if (kind === 'confirm') {
      if (!seenBank) { setMsg('Tick “I have seen the payment” first — confirm means the money is in our bank.'); return; }
      if (paid < expected) { setMsg(`Blocked: underpayment outstanding ₦${(expected - paid).toLocaleString()}`); return; }
      setBusy(true); setMsg('Working — saving to Supabase…');
      try {
        const r: any = await confirmOrder({ pendingRef: params.id, verifiedAmount: paid, seenBank: true });
        if (r.ok) { setVerified(r.displayId); setMsg(`Confirmed ${r.displayId} in Supabase. Stock reserved (available-=qty, reserved+=qty).` + (r.over ? ` Overpayment excess ₦${Number(r.over).toLocaleString()} → Store Credit.` : '')); return; }
        if (r.reason === 'race-lost') { setMsg('Blocked: stock gone at verify — amount goes to Store Credit.'); return; }
        if (r.reason === 'underpayment') { setMsg(`Underpayment in Supabase. Outstanding ₦${Number(r.outstanding || 0).toLocaleString()}.`); return; }
        setMsg(`Not saved — Supabase said: ${r.reason || 'unknown'}. Nothing changed. Try again.`);
        return;
      } catch { setMsg('Not saved — could not reach Supabase. Nothing changed. Try again.'); return; }
      finally { setBusy(false); }
    }
    if (kind === 'under') {
      const r: any = await underPending({ ref: params.id, admin: 'owner' }).catch(() => null);
      setMsg(r && r.ok ? `Marked Underpayment in Supabase. Outstanding ₦${(expected - paid).toLocaleString()}. No Order ID, no stock move.` : 'Could not save — try again.');
    }
    if (kind === 'reject') {
      const r: any = await rejectPending({ ref: params.id, reason, note, admin: 'owner' }).catch(() => null);
      setMsg(r && r.ok ? `Rejected (${reason}). Customer sees the reason.` : 'Rejected. No Order ID, no stock move.');
    }
  };
  const [curStatus, setCurStatus] = useState('');
  const step = async (to: string) => {
    if (!orderId) return;
    const r: any = await advanceOrder({ orderId, to, actor: 'owner' }).catch(() => null);
    if (r && r.ok) { setCurStatus(to); setMsg(`Moved to ${r.label}. Customer notified in-app.`); reloadMsgs(); }
    else setMsg('Step not allowed from here.');
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
  if (!o) return <div className="card">No order with this reference in Supabase yet.</div>;
  if (!allowed) return <div className="card">Checking admin session…</div>;
  return (<div><div className="card"><h2>Order {params.id} — full record</h2>
    <div>Customer: {o.name} • {o.phone} • {o.method} {o.area}</div>
    <div>Expected ₦{(o.total||0).toLocaleString()} vs Submitted ₦{o.amount} • Date {o.date} • Ref {o.ref}{live && live.pending && live.pending.reference_id ? ` • ${live.pending.reference_id}` : ''}</div>
    {live && live.submissions && live.submissions.length > 0 && <div className="small">Submitted amounts: {live.submissions.map((s: any) => `₦${Number(s.amountClaimed).toLocaleString()}`).join(' + ')}{live.submissions[live.submissions.length - 1].reference ? ` • bank ref: ${live.submissions[live.submissions.length - 1].reference}` : ''}</div>}
    <div>Stockpile: confirmed date → free days → daily fee (live Settings). Release blocked if fee unpaid.</div>
    {proofUrl ? <div><div className="small">Customer receipt:</div><img src={proofUrl} alt="payment receipt" style={{ maxWidth: '100%', borderRadius: 10 }} /></div> : null}
    <div><label><input type="checkbox" checked={seenBank} onChange={e=>setSeenBank(e.target.checked)} /> I have seen the payment — required</label></div>
    <button className="btn" onClick={() => act('confirm')}>Confirm</button> <button className="btn" onClick={() => act('under')}>Mark Under</button>
    {orderId && (<div style={{ marginTop: 8 }}><b>Progress: {stepLabel(curStatus) || curStatus || '…'}</b><div>
      {curStatus === 'processing' && <button className="btn-s" onClick={() => step('packaged')}>Next: Being packed →</button>}
      {curStatus === 'packaged' && <span><button className="btn-s" onClick={() => step('onway')}>On the way →</button> <button className="btn-s" onClick={() => step('ready')}>Ready for pickup →</button></span>}
      {(curStatus === 'onway' || curStatus === 'ready') && <button className="btn-s" onClick={() => step('completed')}>Completed →</button>}
    </div></div>)}
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
