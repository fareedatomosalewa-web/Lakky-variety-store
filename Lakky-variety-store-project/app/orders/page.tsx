'use client';
import { useEffect, useRef, useState } from 'react';
import { trackOrder } from '../../lib/shop-actions';
import { useCustomerOnly } from '../../lib/use-customer-only';
import { pushNotice } from '../../lib/harden';
import { TimelineSteps } from '../../lib/timeline';
import { cancelOrder, getMessages, postMessage, requestMoney, setProgress, addReview, reportProblem } from '../../lib/shop-v1';
import { askNotifyPermission, toast } from '../../lib/notify-client';
const STEP_LABEL: Record<string, string> = { pending: 'Waiting for confirmation', processing: 'Confirmed', packaged: 'Being packed', ready: 'Ready for pickup', onway: 'On the way', completed: 'Completed', cancelled: 'Cancelled', 'cancel-requested': 'Cancellation requested' };
const stepName = (s: string) => STEP_LABEL[s] || s;
const CANCEL_REASONS = ['Price too high', 'No longer interested', 'Found it elsewhere', 'Ordered by mistake', 'Other'];
const when = (iso: any) => { try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function TimelineCard({ o }: { o: any }) {
  const freeDate = o.freeUntil ? new Date(o.freeUntil + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  const isStockpile = (o.method || '') === 'Stockpile';
  const done = o.fulfilment === 'completed';
  return (<div className="card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <h2 style={{ margin: 0, overflowWrap: 'anywhere' }}>{o.displayId}</h2>
      <span className={done ? 'badge badge-ok' : 'badge'}>{stepName(o.fulfilment)}</span>
    </div>
    <div className="small">₦{Number(o.paid).toLocaleString()} paid of ₦{Number(o.total).toLocaleString()}</div>
    {done
      ? <div className="notice-ok" style={{ whiteSpace: 'normal' }}>✅ This order is completed{o.completedAt ? ` (${when(o.completedAt)})` : ''}. Your chat stays open — message us any time.</div>
      : <TimelineSteps fulfilment={o.fulfilment} confirmedAt={o.confirmedAt} hasReceipt={o.hasReceipt} />}
    {isStockpile && freeDate && (<div className="notice-ok" style={{ overflowWrap: 'anywhere', whiteSpace: 'normal', wordBreak: 'break-word' }}>🕒 Free hold until <b>{freeDate}</b>, then ₦{Number(o.rate).toLocaleString()}/day{Number(o.extraDays) > 0 ? ` (${Number(o.extraDays)} days over)` : ''}.</div>)}
  </div>);
}

function WaitingCard({ p }: { p: any }) {
  return (<div className="card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <h2 style={{ margin: 0, overflowWrap: 'anywhere' }}>{p.displayId}</h2>
      <span className="badge">Waiting</span>
    </div>
    <div style={{ marginTop: 8 }}>Your order is waiting for payment confirmation. Tracking opens as soon as we confirm your payment, and we’ll notify you.</div>
    {p.notice ? <div className="small" style={{ marginTop: 8 }}>Message from shop: {p.notice}</div> : null}
  </div>);
}

function seenKey(id: string | number) { return `lakky-seen-${id}`; }
function flagNewOwnerMsgs(thread: string | number, messages: any[], orderLabel: string) {
  try {
    const seen = Number(localStorage.getItem(seenKey(thread)) || '0');
    const owners = messages.filter((m) => m.sender === 'owner');
    if (owners.length > seen) {
      pushNotice('message', `New message from the shop on ${orderLabel}: ${owners[owners.length - 1].text.slice(0, 120)}`);
      localStorage.setItem(seenKey(thread), String(owners.length));
    }
  } catch { /* notices best-effort */ }
}

function Thread({ messages, draft, setDraft, send, label }: { messages: any[]; draft: string; setDraft: (v: string) => void; send: () => void; label: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  return (<div className="card">
    <h3 style={{ marginTop: 0 }}>Messages · {label}</h3>
    {messages.length === 0 && <div className="small">No messages yet. Write to the shop here — we reply here too.</div>}
    <div className="msgs">
      {messages.map((m, i) => (
        <div key={i} className={`msgrow ${m.sender === 'customer' ? 'me' : ''}`}>
          <div>
            <div className="bubble">{m.text}</div>
            <div className="msgmeta" style={{ textAlign: m.sender === 'customer' ? 'right' : 'left' }}>{m.sender === 'owner' ? 'Shop' : 'You'}{m.at ? ` • ${when(m.at)}` : ''}</div>
          </div>
        </div>
      ))}
      <div ref={end} />
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input style={{ flex: 1 }} placeholder="Write to the shop…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
      <button className="btn-s" onClick={send} disabled={!draft.trim()}>Send</button>
    </div>
  </div>);
}

export default function OrdersPage() {
  useCustomerOnly();
  const [orderId, setOrderId] = useState(''); const [phone, setPhone] = useState(''); const [res, setRes] = useState('');
  const [o, setO] = useState<any>(null);
  const [pend, setPend] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [pendMsgs, setPendMsgs] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [pendDraft, setPendDraft] = useState('');
  const [reason, setReason] = useState(CANCEL_REASONS[0]); const [note, setNote] = useState('');
  const [stars, setStars] = useState(5); const [revNote, setRevNote] = useState(''); const [rated, setRated] = useState(false);
  const [prob, setProb] = useState(''); const [reported, setReported] = useState(false);
  const [bank, setBank] = useState({ name: '', number: '', account: '' });
  const [alerts, setAlerts] = useState('');
  const loadMsgs = async (id: number, label: string, quiet = false) => {
    const r: any = await getMessages({ orderId: id }).catch(() => null);
    if (r && r.ok) {
      setMsgs(r.messages);
      if (!quiet) flagNewOwnerMsgs(`order-${id}`, r.messages, label);
    }
  };
  const loadPendMsgs = async (pendingId: number, label: string) => { const r: any = await getMessages({ pendingId }).catch(() => null); if (r && r.ok) { setPendMsgs(r.messages); flagNewOwnerMsgs(`pending-${pendingId}`, r.messages, label); } };
  const lookup = async () => {
    if (!orderId || !phone) { setRes('Both Order ID and matching phone are required. Phone alone cannot retrieve.'); return; }
    setO(null); setPend(null); setPendMsgs([]); setMsgs([]); setRated(false); setReported(false);
    try {
      const r: any = await trackOrder({ displayId: orderId, phone });
      if (r.ok && r.order) {
        setO({ ...r.order, phone });
        const oo = r.order;
        const feeBit = (oo.method || '') === 'Stockpile' ? ` — free until ${oo.freeUntil} — fee ₦${Number(oo.fee).toLocaleString()} (${oo.extraDays} days × ₦${Number(oo.rate).toLocaleString()}).` : '';
        setRes(`Found ${oo.displayId} — ${oo.status} — now: ${stepName(oo.fulfilment)} — paid ₦${Number(oo.paid).toLocaleString()} of ₦${Number(oo.total).toLocaleString()}.${feeBit}`);
        loadMsgs(oo.id, oo.displayId);
        return;
      }
      if (r.ok && (r as any).pending) {
        const p = r as any;
        setPend({ ...p, phone });
        setRes(`${p.displayId} — waiting for payment confirmation (Expected ₦${Number(p.total).toLocaleString()}).${p.notice ? ` Message from shop: ${p.notice}` : ''}`);
        loadPendMsgs(p.pendingId, p.displayId);
        return;
      }
    } catch { /* fall through to not-found */ }
    setRes('No match. Check your Order ID + the phone you used at checkout.');
  };
  // While this order is open, quietly refresh the chat so new shop replies
  // appear (the header also shows a pop-up for them).
  useEffect(() => {
    if (!o?.id) return;
    const t = setInterval(() => loadMsgs(o.id, o.displayId, true), 20000);
    return () => clearInterval(t);
  }, [o?.id]);
  const send = async () => {
    if (!draft.trim() || !o) return;
    await postMessage({ orderId: o.id, sender: 'customer', text: draft }).catch(() => null);
    setDraft(''); loadMsgs(o.id, o.displayId);
  };
  const sendPend = async () => {
    if (!pendDraft.trim() || !pend) return;
    await postMessage({ pendingId: pend.pendingId, sender: 'customer', text: pendDraft }).catch(() => null);
    setPendDraft(''); loadPendMsgs(pend.pendingId, pend.displayId);
  };
  const cancel = async () => {
    if (!o) return;
    if (reason === 'Other' && !note.trim()) { alert('Please write a short note for Other.'); return; }
    await cancelOrder({ orderId: o.id, phone, reason, note }).catch(() => null);
    lookup();
  };
  const money = async (kind: string, amount?: number) => {
    if (!o) return;
    await requestMoney({ orderId: o.id, phone, kind, amount, bankName: bank.name, accountNumber: bank.number, accountName: bank.account }).catch(() => null);
    toast(kind === 'credit' ? 'Store credit choice saved.' : 'Refund request saved. The owner will check the account name on the bank alert.');
  };
  const received = async () => {
    if (!o) return;
    await setProgress({ ids: [o.id], to: 'completed', actor: 'customer' }).catch(() => null);
    lookup();
  };
  const review = async () => {
    if (!o) return;
    await addReview({ productName: 'Order ' + o.displayId, customerName: '', orderId: o.id, stars, note: revNote }).catch(() => null);
    setRevNote(''); setRated(true); toast('Thanks for the stars.');
  };
  const report = async () => {
    if (!o || !prob.trim()) { toast('Please describe the problem first.'); return; }
    const r: any = await reportProblem({ orderId: o.id, reason: prob }).catch(() => null);
    if (r && r.ok === false) {
      toast(r.reason === 'window-closed' ? 'The report window has closed. Please message us in the chat.' : r.reason === 'not-completed' ? 'You can report a problem after the order is completed.' : 'Could not send the report. Please try again.');
      return;
    }
    setProb(''); setReported(true); toast('Problem sent. The owner will review it.');
  };
  const enableAlerts = async () => {
    const p = await askNotifyPermission();
    if (p === 'granted') { setAlerts('Alerts are on for this device.'); toast('Alerts on. We will pop up when the shop replies.'); }
    else if (p === 'denied' || p === 'blocked') setAlerts('Alerts are blocked in your browser settings.');
    else setAlerts('Your browser does not support alerts — messages still appear here.');
  };
  const reportOpen = (() => {
    if (!o || o.fulfilment !== 'completed') return false;
    const done = new Date(o.completedAt || o.confirmedAt || Date.now()).getTime();
    return Date.now() - done < 48 * 3600000;
  })();
  return (<div>
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Track order</h2>
      <input placeholder="Order ID (e.g. LVS-001-2345)" value={orderId} onChange={e => setOrderId(e.target.value)} />
      <input placeholder="Phone used at checkout" value={phone} onChange={e => setPhone(e.target.value)} />
      <button className="btn" style={{ width: '100%' }} onClick={lookup}>Track</button>
      {res && <div className="small notice-ok" style={{ whiteSpace: 'normal' }}>{res}</div>}
      <div className="small" style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-s" onClick={enableAlerts}>🔔 Turn on reply alerts</button>
        {alerts && <span>{alerts}</span>}
      </div>
    </div>
    {pend && !o && (<WaitingCard p={pend} />)}
    {pend && !o && <Thread messages={pendMsgs} draft={pendDraft} setDraft={setPendDraft} send={sendPend} label={pend.displayId} />}
    {o && o.id && (<TimelineCard o={o} />)}
    {o && o.id && <Thread messages={msgs} draft={draft} setDraft={setDraft} send={send} label={o.displayId} />}
    {o && o.id && o.status === 'overpayment' && (<div className="card">
      <h3 style={{ marginTop: 0 }}>You paid extra</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-s" onClick={() => money('credit', Number(o.paid) - Number(o.total))}>Keep ₦{(Number(o.paid) - Number(o.total)).toLocaleString()} as store credit</button>
        <button className="btn-s" onClick={() => money('refund', Number(o.paid) - Number(o.total))}>Refund ₦{(Number(o.paid) - Number(o.total)).toLocaleString()} to my account</button>
      </div>
      <div className="small" style={{ marginTop: 6 }}>Refund goes only to the account you paid from.</div>
      <input placeholder="Bank name" value={bank.name} onChange={(e) => setBank({ ...bank, name: e.target.value })} />
      <input placeholder="Account number" value={bank.number} onChange={(e) => setBank({ ...bank, number: e.target.value })} />
      <input placeholder="Account name" value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value })} />
      <div className="small">Must be the same account you paid from.</div>
    </div>)}
    {o && o.id && (o.fulfilment === 'processing' || o.fulfilment === 'pending' || o.fulfilment === 'packaged') && (<div className="card">
      <h3 style={{ marginTop: 0 }}>Cancel this order</h3>
      <select value={reason} onChange={(e) => setReason(e.target.value)}>{CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
      {reason === 'Other' && <input placeholder="Short note" value={note} onChange={(e) => setNote(e.target.value)} />}
      <button className="btn-d" style={{ width: '100%' }} onClick={cancel}>Cancel order</button>
      <div className="small">Cancel is only possible before the order is ready.</div>
    </div>)}
    {o && o.id && (o.fulfilment === 'ready' || o.fulfilment === 'onway') && (<div className="card">
      <h3 style={{ marginTop: 0 }}>Got your order?</h3>
      <button className="btn" style={{ width: '100%' }} onClick={received}>I received it</button>
    </div>)}
    {o && o.id && o.fulfilment === 'completed' && (<div className="card">
      <h3 style={{ marginTop: 0 }}>Rate & report</h3>
      <div className="small" style={{ marginBottom: 4 }}>Rate this order</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={stars} onChange={(e) => setStars(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} stars</option>)}</select>
        <input style={{ flex: 1, minWidth: 160 }} placeholder="Note (optional)" value={revNote} onChange={(e) => setRevNote(e.target.value)} />
        <button className="btn-s" onClick={review} disabled={rated}>{rated ? 'Stars sent ✓' : 'Send stars'}</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="small" style={{ marginBottom: 4 }}>{reportOpen ? 'Report a problem (within 48 hours of completion)' : 'Problem report window has closed — use the chat above.'}</div>
        {reportOpen && !reported && (<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ flex: 1, minWidth: 160 }} placeholder="What is wrong?" value={prob} onChange={(e) => setProb(e.target.value)} />
          <button className="btn-s" onClick={report}>Send report</button>
        </div>)}
        {reported && <div className="small">Report sent ✓ — the owner will review it.</div>}
      </div>
    </div>)}
  </div>);
}
