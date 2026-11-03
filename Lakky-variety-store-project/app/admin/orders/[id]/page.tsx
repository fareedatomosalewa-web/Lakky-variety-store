'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { confirmOrder, getSubmissionProof } from '../../../../lib/shop-actions';
import { useAdminGuard } from '../../../../lib/use-admin-guard';
import { n } from '../../../../lib/pricing';
import { TimelineSteps } from '../../../../lib/timeline';
import { getAdminOrderDetail, getOrderThread, markThreadSeen, postMessage, advanceOrder } from '../../../../lib/shop-v1';
import { stepLabel } from '../../../../lib/pricing';
import { toast } from '../../../../lib/notify-client';
const REJECTS = ['Underpayment', 'Fake receipt', 'Wrong order'];

export default function AdminOrder({ params }: { params: { id: string } }) {
  const allowed = useAdminGuard(['admin', 'staff']);
  const [d, setD] = useState<any>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [loadErr, setLoadErr] = useState('');
  const [verified, setVerified] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [reason, setReason] = useState(REJECTS[0]); const [note, setNote] = useState('');
  const [light, setLight] = useState(false); const [zoom, setZoom] = useState(1);
  const [proofLegacy, setProofLegacy] = useState(false); const [proofBroken, setProofBroken] = useState(false);
  const [curStatus, setCurStatus] = useState('');
  const [flow, setFlow] = useState<'idle' | 'exact' | 'less' | 'more'>('idle');
  const [overAmt, setOverAmt] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    setLoadState('loading'); setLoadErr('');
    const r: any = await getAdminOrderDetail({ ref: params.id }).catch(() => null);
    if (!alive.current) return;
    if (!r || !r.ok) {
      setLoadState('error');
      setLoadErr('Could not load this order from Supabase. Nothing has changed.');
      return;
    }
    if (!r.found) { setLoadState('missing'); return; }
    setD(r);
    setMsgs(r.messages || []);
    setCurStatus(r.order?.status || '');
    setLoadState('ready');
    if (r.order?.id || r.pending?.id) {
      markThreadSeen({ orderId: r.order?.id, pendingId: r.pending?.id }).catch(() => {});
    }
  }, [params.id]);

  useEffect(() => { alive.current = true; load(); }, [load]);

  // Receipt preview is a separate signed-link call; it must never block the page.
  useEffect(() => {
    getSubmissionProof({ ref: params.id }).then((r: any) => {
      if (!alive.current || !r || !r.ok) return;
      if (r.url) setProofUrl(r.url);
      if (r.legacy) setProofLegacy(true);
    }).catch(() => {});
  }, [params.id]);

  // Keep the conversation live while the page is open. Reads both the pending
  // and order message rows, so nothing disappears after confirmation.
  useEffect(() => {
    if (loadState !== 'ready') return;
    const t = setInterval(async () => {
      const r: any = await getOrderThread({ ref: params.id }).catch(() => null);
      if (!alive.current || !r || !r.ok) return;
      setMsgs(r.messages || []);
      if (r.status) setCurStatus(r.status);
    }, 10000);
    return () => clearInterval(t);
  }, [loadState, params.id]);

  const reloadMsgs = async () => {
    const r: any = await getOrderThread({ ref: params.id }).catch(() => null);
    if (r && r.ok) { setMsgs(r.messages || []); if (r.status) setCurStatus(r.status); }
  };

  const dFigures = d?.figures || null;
  const o = useMemo(() => {
    if (!d) return null;
    const ord = d.order || null; const pend = d.pending || null;
    if (!ord && !pend) return null;
    return {
      displayId: ord?.displayId || pend?.displayId || pend?.ref || params.id,
      total: pend?.expectedTotal ?? ord?.total ?? 0,
      name: d.customer?.name || '', phone: d.customer?.phone || '',
      method: ord?.method || pend?.method || '', area: pend?.area || (ord?.details || {}).area || '',
      date: String(ord?.confirmedAt || pend?.createdAt || '').slice(0, 10),
      status: ord?.status || pend?.status || '',
      isOrder: !!ord,
    };
  }, [d, params.id]);

  const orderId = d?.order?.id || null;
  const pendingId = d?.pending?.id || null;
  const awaitingPayment = !orderId && !!d?.pending && ['pending', 'under'].includes(String(d.pending.status));

  const act = async (kind: string) => {
    if (busy) return;
    const expected = dFigures ? n(dFigures.expectedTotal) : n(o?.total);
    const submitted = dFigures ? n(dFigures.submittedTotal) : 0;
    if (!expected) { setMsg('No expected amount on this order — open it from the queue again.'); return; }
    if (kind === 'confirm') {
      const paid = flow === 'more' ? Math.round(Number(overAmt) || 0) : submitted;
      if (flow === 'more' && paid <= expected) { setMsg('That amount is not more than expected — use Exact or Less instead.'); return; }
      if (flow !== 'more' && paid < expected) { setMsg(`Blocked: ₦${(expected - paid).toLocaleString()} short — use Less instead.`); return; }
      setBusy(true); setMsg('Working — saving to Supabase…');
      try {
        const r: any = await confirmOrder({ pendingRef: params.id, verifiedAmount: paid, seenBank: true });
        if (r.ok) {
          setVerified(r.displayId);
          setMsg(`Confirmed ${r.displayId} in Supabase.` + (r.over ? ` Overpayment ₦${Number(r.over).toLocaleString()} — customer picks store credit or refund.` : ''));
          setFlow('idle');
          await load();
          return;
        }
        if (r.reason === 'race-lost') { setMsg('Blocked: stock gone at verify — amount goes to Store Credit.'); return; }
        if (r.reason === 'underpayment') { setMsg(`Underpayment in Supabase. Outstanding ₦${Number(r.outstanding || 0).toLocaleString()}.`); return; }
        setMsg(`Not saved — Supabase said: ${r.reason || 'unknown'}. Nothing changed. Try again.`);
        return;
      } catch { setMsg('Not saved — could not reach Supabase. Nothing changed. Try again.'); return; }
      finally { setBusy(false); }
    }
    if (kind === 'reject') {
      const r: any = await import('../../../../lib/shop-v1').then((m) => m.rejectPending({ ref: params.id, reason, note, admin: 'owner' })).catch(() => null);
      setMsg(r && r.ok ? `Rejected (${reason}). Customer sees the reason.` : 'Could not reject. Try again.');
      setRejectOpen(false); setFlow('idle');
    }
  };

  const step = async (to: string) => {
    if (!orderId) return;
    const r: any = await advanceOrder({ orderId, to, actor: 'owner' }).catch(() => null);
    if (r && r.ok) {
      setCurStatus(to);
      setMsg(to === 'completed' ? 'Order completed — moved to the Completed section.' : `Moved to ${r.label}. Customer notified in-app.`);
      await load();
    } else setMsg('Step not allowed from here.');
  };

  const sendReply = async () => {
    if (!reply.trim() || (!orderId && !pendingId)) return;
    const text = reply.trim();
    const r: any = orderId
      ? await postMessage({ orderId, sender: 'owner', text }).catch(() => null)
      : await postMessage({ pendingId: pendingId as number, sender: 'owner', text }).catch(() => null);
    if (!r || !r.ok) { setMsg('Reply not saved — could not reach Supabase. Try again.'); return; }
    setMsgs((m) => [...m, r.message || { sender: 'owner', text }]);
    setReply('');
    setMsg('Reply sent to the customer.');
    reloadMsgs();
  };

  const decide = async (id: number, approve: boolean) => {
    const m: any = await import('../../../../lib/shop-v1').then((x) => x.decideRefund({ id, approve, admin: 'owner' })).catch(() => null);
    if (m && m.ok) { setD((x: any) => ({ ...x, refunds: (x.refunds || []).filter((r: any) => r.id !== id) })); toast(approve ? 'Refund approved.' : 'Refund declined.'); }
    else toast('Could not save that decision. Try again.');
  };

  const openReceipt = async () => {
    const fresh: any = await getSubmissionProof({ ref: params.id }).catch(() => null);
    if (fresh && fresh.ok && fresh.url) { setProofUrl(fresh.url); setProofBroken(false); }
    setZoom(1); setLight(true);
  };

  if (loadState === 'loading') return <div className="card"><b>Loading order…</b><div className="small">Checking Supabase for {params.id}.</div></div>;
  if (loadState === 'error') return (<div className="card"><b>Could not load this order.</b><div className="small">{loadErr}</div><div style={{ marginTop: 10 }}><button className="btn" onClick={load}>Retry</button></div></div>);
  if (loadState === 'missing') return (<div className="card"><b>No order with this ID in Supabase yet.</b><div className="small">Checked {params.id}. If you just confirmed it, wait a second and tap Retry.</div><div style={{ marginTop: 10 }}><button className="btn" onClick={load}>Retry</button></div></div>);
  if (!allowed) return <div className="card">Checking admin session…</div>;
  if (!o) return <div className="card">No order with this ID in Supabase yet.</div>;

  const exp = dFigures ? n(dFigures.expectedWithFee) : n(o.total);
  const expBase = dFigures ? n(dFigures.expectedTotal) : n(o.total);
  const feeAmt = dFigures ? n(dFigures.feeAmount) : 0;
  const showMoney = dFigures ? (dFigures.under || dFigures.over) : false;
  const submissions = d?.submissions || [];
  const fees = d?.fees || [];
  const refunds = d?.refunds || [];
  const timeline = d?.timeline || null;

  return (<><div><a href="/admin" style={{ textDecoration: 'none' }}>← Orders</a> <span className="badge">{o.displayId}</span> <span className={curStatus === 'completed' ? 'badge badge-ok' : 'badge badge-mut'}>{stepLabel(curStatus) || curStatus}</span></div>
  <div className="card" style={{ textAlign: 'center' }}><div className="small" style={{ fontWeight: 700 }}>EXPECTED AMOUNT</div>
    <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--plum)' }}>₦{exp.toLocaleString()}</div>
    <div className="small">₦{expBase.toLocaleString()} order{feeAmt > 0 ? ` + ₦${feeAmt.toLocaleString()} stockpile fee` : ''}</div>
    {dFigures && dFigures.isStockpile && dFigures.freeUntil && <div className="small">Free hold until {new Date(dFigures.freeUntil + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{feeAmt > 0 ? ` (${dFigures.extraDays} days over)` : ''}</div>}
    {orderId && <div className="small" style={{ marginTop: 6 }}>Paid ₦{n(d?.order?.paid).toLocaleString()} of ₦{n(d?.order?.total).toLocaleString()}</div>}
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
      {awaitingPayment && (<div className="card"><div className="small" style={{ fontWeight: 700 }}>WHAT DID YOU SEE IN YOUR BANK?</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-s" style={{ flex: 1 }} onClick={() => { setFlow('exact'); setRejectOpen(false); }}>Exact amount</button>
          <button className="btn-s" style={{ flex: 1 }} onClick={() => { setFlow('less'); setReason('Underpayment'); setRejectOpen(true); }}>Less than expected</button>
          <button className="btn-s" style={{ flex: 1 }} onClick={() => { setFlow('more'); setRejectOpen(false); }}>More than expected</button>
        </div>
        {flow === 'exact' && <div style={{ marginTop: 8 }}><button className="btn-ok" style={{ width: '100%' }} onClick={() => act('confirm')} disabled={busy}>Confirm order</button></div>}
        {flow === 'more' && (<div style={{ marginTop: 8 }}><div className="small" style={{ fontWeight: 700 }}>AMOUNT YOU RECEIVED</div>
          <input type="number" placeholder="e.g. 5500" value={overAmt} onChange={(e) => setOverAmt(e.target.value)} />
          <button className="btn-ok" style={{ width: '100%' }} onClick={() => act('confirm')} disabled={busy}>Confirm order</button>
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
    {submissions.length > 0 && <div className="small">Submitted amounts: {submissions.map((s: any) => `₦${n(s.amountClaimed).toLocaleString()}`).join(' + ')}{submissions[submissions.length - 1].reference ? ` • bank ref: ${submissions[submissions.length - 1].reference}` : ''}</div>}
        {awaitingPayment && <div className="small" style={{ marginTop: 8 }}>Waiting for payment confirmation — tracking opens for the customer as soon as you confirm.</div>}
        {dFigures && dFigures.isStockpile && <div style={{ marginTop: 8 }}><button className="btn-s" onClick={async () => { const m: any = await import('../../../../lib/shop-v1').then((x) => x.markFeePaid({ orderId: orderId as number, kind: 'stockpile', admin: 'owner' })).catch(() => null); setMsg(m && m.ok ? 'Stockpile fee marked paid.' : 'Could not mark that fee. Try again.'); }}>Stockpile fee paid</button></div>}
        {orderId && (<div style={{ marginTop: 8 }}><b>Progress: {stepLabel(curStatus) || curStatus || '…'}</b></div>)}
        <div><b>{msg}{verified ? ` ✓` : ''}</b></div>
      </div>
    </div>
    </div>
    {orderId && (<div className="card"><b>Tracking (same as customer sees)</b>
      {timeline && <TimelineSteps fulfilment={curStatus || timeline.fulfilment} confirmedAt={timeline.confirmedAt} compact />}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {(curStatus === 'processing' || curStatus === 'packaged') && <button className="btn-s" onClick={() => step('ready')}>Ready for pickup →</button>}
        {(curStatus === 'ready' || curStatus === 'onway') && <button className="btn-ok" onClick={() => step('completed')}>Complete order ✓</button>}
        {curStatus === 'completed' && <span className="badge badge-ok">Completed — in the Completed section</span>}
      </div></div>)}
    <div className="card"><h3>Messages</h3>
      <div className="small" style={{ marginBottom: 6 }}>Full conversation — before and after confirmation. New replies appear here without a reload.</div>
      {msgs.length === 0 && <div className="small">No messages yet. Chat works from the moment the order is submitted — the customer is notified in-app when you reply.</div>}
      {msgs.map((m, i) => <div key={i} className="small" style={{ marginBottom: 4 }}><b>{m.sender}:</b> {m.text}{m.at ? <span style={{ opacity: 0.6 }}> · {String(m.at).slice(0, 16).replace('T', ' ')}</span> : null}</div>)}
      <div style={{ display: 'flex', gap: 8 }}><input placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }} /><button className="btn-s" onClick={sendReply}>Send</button></div></div>
    {dFigures && dFigures.isStockpile && (<div className="card"><h3>Stockpile fee payments</h3>
      {fees.length === 0 && <div className="small">None recorded for this order.</div>}
      {fees.map((f: any) => <div key={f.id} className="small">#{f.id} ₦{Number(f.amount).toLocaleString()} [{f.status}] by {f.by || 'owner'}</div>)}
    </div>)}
    {showMoney && (<div className="card"><h3>Refund / credit requests</h3>
      {refunds.length === 0 && <div className="small">None pending.</div>}
      {refunds.map((r: any) => <div key={r.id} className="small">#{r.id} {r.kind} ₦{Number(r.amount).toLocaleString()} {r.bank_name} {r.account_number} {r.account_name} [{r.status}] <button className="btn-s" onClick={() => decide(r.id, true)}>Approve</button> <button className="btn-d" onClick={() => decide(r.id, false)}>Decline</button></div>)}
    </div>)}
    {light && proofUrl && (<div onClick={() => setLight(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ maxWidth: '100%', maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}><img src={proofUrl} alt="receipt full screen" onError={() => { setProofBroken(true); setLight(false); toast('That receipt could not be opened. Ask the customer to resend it in the chat.'); }} style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: 'none', borderRadius: 8 }} /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
        <button className="btn-s" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}>− Zoom out</button>
        <button className="btn-s" onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))}>+ Zoom in</button>
        <button className="btn" onClick={() => setLight(false)}>Close ✕</button>
      </div></div>)}
    </>);
}
