'use client';
import { useEffect, useState } from 'react';
import { confirmOrder, getSubmissionProof } from '../../../../lib/shop-actions';
import { useAdminGuard } from '../../../../lib/use-admin-guard';
import { n } from '../../../../lib/pricing';
import AdminShell from '../../shell';
import { TimelineSteps } from '../../../../lib/timeline';
import { getOrderThread, getPendingDetail, getMessages, listFees, listRefunds, decideRefund, markFeePaid, markThreadSeen, postMessage, rejectPending, advanceOrder } from '../../../../lib/shop-v1';
import { stepLabel } from '../../../../lib/pricing';
import { toast } from '../../../../lib/notify-client';
const REJECTS = ['Underpayment', 'Fake receipt', 'Wrong order'];
export default function AdminOrder({ params }: { params: { id: string } }) {
  const allowed = useAdminGuard(['admin', 'staff']);
  const [o, setO] = useState<any>(null); const [verified, setVerified] = useState(''); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [live, setLive] = useState<any>(null);
  const [figures, setFigures] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [reason, setReason] = useState(REJECTS[0]); const [note, setNote] = useState('');
  const [refunds, setRefunds] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  // Receipt lightbox + payment-check flow.
  const [light, setLight] = useState(false); const [zoom, setZoom] = useState(1);
  const [proofLegacy, setProofLegacy] = useState(false); const [proofBroken, setProofBroken] = useState(false);
  const openReceipt = async () => {
    // Refresh the signed link (they expire after 15 minutes).
    const fresh: any = await getSubmissionProof({ ref: params.id }).catch(() => null);
    if (fresh && fresh.ok && fresh.url) { setProofUrl(fresh.url); setProofBroken(false); }
    setZoom(1); setLight(true);
  };
  const [flow, setFlow] = useState<'idle' | 'exact' | 'less' | 'more'>('idle');
  const [overAmt, setOverAmt] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  useEffect(() => {
    getPendingDetail({ ref: params.id }).then((r: any) => {
      if (r && r.ok) {
        const pd = r.pending;
        setLive(r);
        setPendingId(pd.id);
        if (r.figures) setFigures(r.figures);
        setO({
          displayId: pd.display_id || pd.ref, ref: pd.ref, total: pd.expected_total,
          amount: r.submissions.length ? r.submissions[r.submissions.length - 1].amountClaimed : pd.expected_total,
          name: pd.name, phone: pd.phone, method: (pd.fulfilment || {}).method, area: (pd.fulfilment || {}).area,
          date: String(pd.created_at || '').slice(0, 10), live: true,
        });
        getMessages({ pendingId: pd.id }).then((m: any) => { if (m && m.ok && m.messages.length) setMsgs(m.messages); }).catch(() => {});
        markThreadSeen({ pendingId: pd.id }).catch(() => {});
      } else {
        setO(null);
      }
    }).catch(() => setO(null));
    getSubmissionProof({ ref: params.id }).then((r: any) => { if (r && r.ok) { if (r.url) setProofUrl(r.url); if (r.legacy) setProofLegacy(true); } }).catch(() => {});
    getOrderThread({ ref: params.id }).then((r: any) => { if (r && r.ok) { if (r.orderId) { setOrderId(r.orderId); setMsgs(r.messages || []); markThreadSeen({ orderId: r.orderId }).catch(() => {}); } else if (r.pendingId) setPendingId(r.pendingId); if (r.timeline) setTimeline(r.timeline); if (r.status) setCurStatus(r.status); if (r.orderId) listFees({ orderId: r.orderId }).then((f: any) => { if (f && f.ok) setFees(f.rows); }).catch(() => {}); } }).catch(() => {});
    listRefunds({}).then((r: any) => { if (r && r.ok) setRefunds(r.rows); }).catch(() => {});
  }, [params.id]);
  const reloadMsgs = async () => {
    if (orderId) {
      const r: any = await getOrderThread({ ref: params.id }).catch(() => null);
      if (r && r.ok) { setOrderId(r.orderId); setMsgs(r.messages || []); if (r.timeline) setTimeline(r.timeline); if (r.status) setCurStatus(r.status); }
    } else if (pendingId) {
      const m: any = await getMessages({ pendingId }).catch(() => null);
      if (m && m.ok) setMsgs(m.messages);
    }
  };
  // Keep the chat fresh while this order is open (customer replies show up here).
  useEffect(() => {
    if (!orderId && !pendingId) return;
    const t = setInterval(() => { reloadMsgs(); }, 15000);
    return () => clearInterval(t);
  }, [orderId, pendingId]);
  const act = async (kind: string) => {
    if (busy) return;
    const expected = figures ? n(figures.expectedTotal) : n(o.total);
    const submitted = figures ? n(figures.submittedTotal) : n(o.amount);
    if (!expected) { setMsg('No expected amount on this order — open it from the queue again.'); return; }
    if (kind === 'confirm') {
      // Tapping Exact / Confirm IS the bank check: the money is in our bank.
      const paid = flow === 'more' ? Math.round(Number(overAmt) || 0) : submitted;
      if (flow === 'more' && paid <= expected) { setMsg('That amount is not more than expected — use Exact or Less instead.'); return; }
      if (flow !== 'more' && paid < expected) { setMsg(`Blocked: ₦${(expected - paid).toLocaleString()} short — use Less instead.`); return; }
      setBusy(true); setMsg('Working — saving to Supabase…');
      try {
        const r: any = await confirmOrder({ pendingRef: params.id, verifiedAmount: paid, seenBank: true });
        if (r.ok) { setVerified(r.displayId); setMsg(`Confirmed ${r.displayId} in Supabase. Stock reserved (available-=qty, reserved+=qty).` + (r.over ? ` Overpayment ₦${Number(r.over).toLocaleString()} — customer picks store credit or refund.` : '')); setFlow('idle'); return; }
        if (r.reason === 'race-lost') { setMsg('Blocked: stock gone at verify — amount goes to Store Credit.'); return; }
        if (r.reason === 'underpayment') { setMsg(`Underpayment in Supabase. Outstanding ₦${Number(r.outstanding || 0).toLocaleString()}.`); return; }
        setMsg(`Not saved — Supabase said: ${r.reason || 'unknown'}. Nothing changed. Try again.`);
        return;
      } catch { setMsg('Not saved — could not reach Supabase. Nothing changed. Try again.'); return; }
      finally { setBusy(false); }
    }
    if (kind === 'reject') {
      const r: any = await rejectPending({ ref: params.id, reason, note, admin: 'owner' }).catch(() => null);
      setMsg(r && r.ok ? `Rejected (${reason}). Customer sees the reason.` : 'Could not reject. Try again.');
      setRejectOpen(false); setFlow('idle');
    }
  };
  const [curStatus, setCurStatus] = useState('');
  const step = async (to: string) => {
    if (!orderId) return;
    const r: any = await advanceOrder({ orderId, to, actor: 'owner' }).catch(() => null);
    if (r && r.ok) { setCurStatus(to); setMsg(to === 'completed' ? 'Order completed — moved to the Completed section.' : `Moved to ${r.label}. Customer notified in-app.`); reloadMsgs(); }
    else setMsg('Step not allowed from here.');
  };
  const sendReply = async () => {
    if (!reply.trim() || (!orderId && !pendingId)) return;
    if (orderId) await postMessage({ orderId, sender: 'owner', text: reply }).catch(() => null);
    else await postMessage({ pendingId: pendingId as number, sender: 'owner', text: reply }).catch(() => null);
    setReply(''); reloadMsgs();
  };
  const fee = async () => {
    if (!orderId) { setMsg('Confirm the order first, then mark the stockpile fee.'); return; }
    await markFeePaid({ orderId, kind: 'stockpile', admin: 'owner' }).catch(() => null);
    setMsg('Stockpile fee marked paid.');
  };
  if (!o) return <AdminShell><div className="card">No order with this ID in Supabase yet.</div></AdminShell>;
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const exp = figures ? n(figures.expectedWithFee) : n(o.total);
  const expBase = figures ? n(figures.expectedTotal) : n(o.total);
  const feeAmt = figures ? n(figures.feeAmount) : 0;
  const showMoney = figures ? (figures.under || figures.over) : false;
  return (<AdminShell><div><a href="/admin" style={{ textDecoration: 'none' }}>← Orders</a> <span className="badge">{o.displayId}</span> <span className="badge badge-mut">{live && live.pending ? live.pending.status : ''}</span></div>
  <div className="card" style={{ textAlign: 'center' }}><div className="small" style={{ fontWeight: 700 }}>EXPECTED AMOUNT</div>
    <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--plum)' }}>₦{exp.toLocaleString()}</div>
    <div className="small">₦{expBase.toLocaleString()} order{feeAmt > 0 ? ` + ₦${feeAmt.toLocaleString()} stockpile fee` : ''}</div>
    {figures && figures.isStockpile && figures.freeUntil && <div className="small">Free hold until {new Date(figures.freeUntil + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{feeAmt > 0 ? ` (${figures.extraDays} days over)` : ''}</div>}
  </div>
  <div className="twocol">
    <div className="card"><div className="small" style={{ fontWeight: 700 }}>CUSTOMER RECEIPT</div>
      {proofUrl && !proofBroken ? (<div>
        <img src={proofUrl} alt="payment receipt — tap to enlarge" onClick={openReceipt} onError={() => setProofBroken(true)} style={{ width: '100%', maxHeight: 380, objectFit: 'contain', borderRadius: 10, cursor: 'zoom-in', border: '1px solid var(--line)', background: '#FDF6EE' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn-s" onClick={openReceipt}>🔍 Open full screen</button>
          <a className="btn-s" href={proofUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Open in new tab</a>
        </div>
      </div>) : (
        <div className="empty">{proofLegacy ? 'This old receipt was stored on the previous host and the file is no longer available. Ask the customer to send a new photo in the chat.' : proofBroken ? 'The receipt photo could not be opened. Tap “Try again” — if it still fails, ask the customer to resend it.' : 'No receipt uploaded yet.'}
          <div style={{ marginTop: 8 }}><button className="btn-s" onClick={openReceipt}>Try again</button></div>
        </div>
      )}
    </div>
    <div>
      {!orderId && (<div className="card"><div className="small" style={{ fontWeight: 700 }}>WHAT DID YOU SEE IN YOUR BANK?</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-s" style={{ flex: 1 }} onClick={() => { setFlow('exact'); setRejectOpen(false); }}>Exact amount</button>
          <button className="btn-s" style={{ flex: 1 }} onClick={() => { setFlow('less'); setReason('Underpayment'); setRejectOpen(true); }}>Less than expected</button>
          <button className="btn-s" style={{ flex: 1 }} onClick={() => { setFlow('more'); setRejectOpen(false); }}>More than expected</button>
        </div>
        {flow === 'exact' && <div style={{ marginTop: 8 }}><button className="btn-ok" style={{ width: '100%' }} onClick={() => act('confirm')}>Confirm order</button></div>}
        {flow === 'more' && (<div style={{ marginTop: 8 }}><div className="small" style={{ fontWeight: 700 }}>AMOUNT YOU RECEIVED</div>
          <input type="number" placeholder="e.g. 5500" value={overAmt} onChange={(e) => setOverAmt(e.target.value)} />
          <button className="btn-ok" style={{ width: '100%' }} onClick={() => act('confirm')}>Confirm order</button>
          <div className="small">The customer is notified and picks store credit or refund.</div></div>)}
        {(flow === 'less' || rejectOpen) && (<div style={{ marginTop: 8 }}><div className="small" style={{ fontWeight: 700 }}>REJECT — CUSTOMER IS TOLD</div>
          <div><b>Reason</b> <select value={reason} onChange={(e) => setReason(e.target.value)}>{REJECTS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <input placeholder="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-d" style={{ width: '100%' }} onClick={() => act('reject')}>Reject order</button></div>)}
        {!rejectOpen && flow !== 'less' && <div style={{ marginTop: 8 }}><button className="btn-d" style={{ width: '100%' }} onClick={() => { setRejectOpen(true); setFlow('idle'); }}>Reject…</button></div>}
      </div>)}
      <div className="card"><div className="small" style={{ fontWeight: 700 }}>ORDER</div>
        <div>Customer: {o.name} • {o.phone} • {o.method} {o.area}</div>
    <div>Expected ₦{n(o.total).toLocaleString()} • Date {o.date} • Order ID {o.displayId}</div>
    {live && live.submissions && live.submissions.length > 0 && <div className="small">Submitted amounts: {live.submissions.map((s: any) => `₦${n(s.amountClaimed).toLocaleString()}`).join(' + ')}{live.submissions[live.submissions.length - 1].reference ? ` • bank ref: ${live.submissions[live.submissions.length - 1].reference}` : ''}</div>}
        {!orderId && <div className="small" style={{ marginTop: 8 }}>Waiting for payment confirmation — tracking opens for the customer as soon as you confirm.</div>}
        {figures && figures.isStockpile && <div style={{ marginTop: 8 }}><button className="btn-s" onClick={fee}>Stockpile fee paid</button></div>}
        {orderId && (<div style={{ marginTop: 8 }}><b>Progress: {stepLabel(curStatus) || curStatus || '…'}</b></div>)}
        <div><b>{msg}</b></div>
      </div>
    </div>
    </div>
    {orderId && timeline && (<div className="card"><b>Tracking (same as customer sees)</b>
      <TimelineSteps fulfilment={curStatus || timeline.fulfilment} confirmedAt={timeline.confirmedAt} compact />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {(curStatus === 'processing' || (!curStatus && timeline.fulfilment === 'processing') || curStatus === 'packaged') && <button className="btn-s" onClick={() => step('ready')}>Ready for pickup →</button>}
        {(curStatus === 'ready' || curStatus === 'onway') && <button className="btn-ok" onClick={() => step('completed')}>Complete order ✓</button>}
        {curStatus === 'completed' && <span className="badge badge-ok">Completed — in the Completed section</span>}
      </div></div>)}
    <div className="card"><h3>Messages</h3>
      {msgs.length === 0 && <div className="small">No messages yet. Chat works from the moment the order is submitted — the customer is notified in-app when you reply.</div>}
      {msgs.map((m, i) => <div key={i} className="small"><b>{m.sender}:</b> {m.text}</div>)}
      <div style={{ display: 'flex', gap: 8 }}><input placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} /><button className="btn-s" onClick={sendReply}>Send</button></div></div>
    {figures && figures.isStockpile && (<div className="card"><h3>Stockpile fee payments</h3>
      {fees.length === 0 && <div className="small">None recorded for this order.</div>}
      {fees.map((f: any) => <div key={f.id} className="small">#{f.id} ₦{Number(f.amount).toLocaleString()} [{f.status}] by {f.verified_by || 'owner'}</div>)}
    </div>)}
    {showMoney && (<div className="card"><h3>Refund / credit requests</h3>
      {refunds.length === 0 && <div className="small">None pending.</div>}
      {refunds.map((r) => <div key={r.id} className="small">#{r.id} {r.kind} ₦{Number(r.amount).toLocaleString()} {r.bank_name} {r.account_number} {r.account_name} [{r.status}] <button className="btn-s" onClick={async () => { await decideRefund({ id: r.id, approve: true, admin: 'owner' }); setRefunds(refunds.filter((x) => x.id !== r.id)); }}>Approve</button> <button className="btn-d" onClick={async () => { await decideRefund({ id: r.id, approve: false, admin: 'owner' }); setRefunds(refunds.filter((x) => x.id !== r.id)); }}>Decline</button></div>)}
    </div>)}
    {light && proofUrl && (<div onClick={() => setLight(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ maxWidth: '100%', maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}><img src={proofUrl} alt="receipt full screen" onError={() => { setProofBroken(true); setLight(false); toast('That receipt could not be opened. Ask the customer to resend it in the chat.'); }} style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: 'none', borderRadius: 8 }} /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
        <button className="btn-s" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}>− Zoom out</button>
        <button className="btn-s" onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))}>+ Zoom in</button>
        <button className="btn" onClick={() => setLight(false)}>Close ✕</button>
      </div></div>)}
    </AdminShell>);
}
