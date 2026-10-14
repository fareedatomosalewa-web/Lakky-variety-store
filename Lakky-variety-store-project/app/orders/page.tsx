'use client';
import { useState } from 'react';
import { trackOrder } from '../../lib/shop-actions';
import { useCustomerOnly } from '../../lib/use-customer-only';
import { pushNotice } from '../../lib/harden';
import { TimelineSteps } from '../../lib/timeline';
import { cancelOrder, getMessages, postMessage, requestMoney, setProgress, addReview, reportProblem } from '../../lib/shop-v1';
const STEP_LABEL: Record<string, string> = { pending: 'Waiting for confirmation', processing: 'Confirmed', packaged: 'Being packed', ready: 'Ready for pickup', onway: 'On the way', completed: 'Completed', cancelled: 'Cancelled', 'cancel-requested': 'Cancellation requested' };
const stepName = (s: string) => STEP_LABEL[s] || s;
const CANCEL_REASONS = ['Price too high', 'No longer interested', 'Found it elsewhere', 'Ordered by mistake', 'Other'];

function TimelineCard({ o }: { o: any }) {
  const freeDate = o.freeUntil ? new Date(o.freeUntil + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  const isStockpile = (o.method || '') === 'Stockpile';
  return (<div className="card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 style={{ margin: 0, overflowWrap: 'anywhere' }}>{o.displayId}</h2>
      <span className={o.fulfilment === 'completed' ? 'badge badge-ok' : 'badge'}>{stepName(o.fulfilment)}</span>
    </div>
    <div className="small">₦{Number(o.paid).toLocaleString()} paid of ₦{Number(o.total).toLocaleString()}</div>
    <TimelineSteps fulfilment={o.fulfilment} confirmedAt={o.confirmedAt} hasReceipt={o.hasReceipt} />
    {isStockpile && freeDate && (<div className="notice-ok" style={{ overflowWrap: 'anywhere', whiteSpace: 'normal', wordBreak: 'break-word' }}>🕒 Free hold until <b>{freeDate}</b>, then ₦{Number(o.rate).toLocaleString()}/day{Number(o.extraDays) > 0 ? ` (${o.extraDays} days over)` : ''}.</div>)}
  </div>);
}

function WaitingCard({ p }: { p: any }) {
  return (<div className="card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
  const [stars, setStars] = useState(5); const [revNote, setRevNote] = useState('');
  const [prob, setProb] = useState('');
  const [bank, setBank] = useState({ name: '', number: '', account: '' });
  const loadMsgs = async (id: number, label: string) => { const r: any = await getMessages({ orderId: id }).catch(() => null); if (r && r.ok) { setMsgs(r.messages); flagNewOwnerMsgs(`order-${id}`, r.messages, label); } };
  const loadPendMsgs = async (pendingId: number, label: string) => { const r: any = await getMessages({ pendingId }).catch(() => null); if (r && r.ok) { setPendMsgs(r.messages); flagNewOwnerMsgs(`pending-${pendingId}`, r.messages, label); } };
  const lookup = async () => {
    if (!orderId || !phone) { setRes('Both Order ID and matching phone are required. Phone alone cannot retrieve.'); return; }
    setO(null); setPend(null); setPendMsgs([]);
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
    alert(kind === 'credit' ? 'Store credit choice saved.' : 'Refund request saved. The owner will check the account name on the bank alert.');
  };
  const received = async () => {
    if (!o) return;
    await setProgress({ ids: [o.id], to: 'completed', actor: 'customer' }).catch(() => null);
    lookup();
  };
  const review = async () => {
    if (!o) return;
    await addReview({ productName: 'Order ' + o.displayId, customerName: '', orderId: o.id, stars, note: revNote }).catch(() => null);
    setRevNote(''); alert('Thanks for the stars.');
  };
  const report = async () => {
    if (!o || !prob) return;
    await reportProblem({ orderId: o.id, reason: prob }).catch(() => null);
    setProb(''); alert('Problem sent. The owner will review it.');
  };
  return (<div><div className="card"><h2>Track order</h2>
    <input placeholder="Order ID (e.g. LVS-001-2345)" value={orderId} onChange={e=>setOrderId(e.target.value)} />
    <input placeholder="Phone used at checkout" value={phone} onChange={e=>setPhone(e.target.value)} />
    <button className="btn" style={{ width: '100%' }} onClick={lookup}>Track</button><div>{res}</div></div>
    {pend && !o && (<WaitingCard p={pend} />)}
    {pend && !o && (<div className="card"><h3>Messages about {pend.displayId}</h3>
      {pendMsgs.length === 0 && <div className="small">No messages yet. Write to the shop here — we reply here too.</div>}
      {pendMsgs.map((m, i) => <div key={i} className="small"><b>{m.sender}:</b> {m.text}</div>)}
      <div style={{ display: 'flex', gap: 8 }}><input placeholder="Write to the shop…" value={pendDraft} onChange={(e) => setPendDraft(e.target.value)} /><button className="btn-s" onClick={sendPend}>Send</button></div>
    </div>)}
    {o && o.id && (<TimelineCard o={o} />)}
    {o && o.id && (<div className="card"><h3>Messages about {o.displayId}</h3>
      {msgs.map((m, i) => <div key={i} className="small"><b>{m.sender}:</b> {m.text}</div>)}
      <div style={{ display: 'flex', gap: 8 }}><input placeholder="Write to the shop…" value={draft} onChange={(e) => setDraft(e.target.value)} /><button className="btn-s" onClick={send}>Send</button></div>
      {o.status === 'overpayment' && (<div style={{ marginTop: 8 }}><b>You paid extra. Choose:</b><div><button className="btn-s" onClick={() => money('credit', Number(o.paid) - Number(o.total))}>Keep as store credit</button> <button className="btn-s" onClick={() => money('refund', Number(o.paid) - Number(o.total))}>Refund to my account</button></div><div className="small">Refund goes only to the account you paid from.</div><input placeholder="Bank name" value={bank.name} onChange={(e) => setBank({ ...bank, name: e.target.value })} /><input placeholder="Account number" value={bank.number} onChange={(e) => setBank({ ...bank, number: e.target.value })} /><input placeholder="Account name" value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value })} /><div className="small">Must be the same account you paid from.</div></div>)}
      {(o.fulfilment === 'processing' || o.fulfilment === 'pending') && (<div style={{ marginTop: 8 }}><b>Cancel this order</b><select value={reason} onChange={(e) => setReason(e.target.value)}>{CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select><input placeholder="Note (needed for Other)" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn-d" onClick={cancel}>Cancel order</button></div>)}
      {(o.fulfilment === 'ready' || o.fulfilment === 'onway') && (<div style={{ marginTop: 8 }}><button className="btn" onClick={received}>I received it</button></div>)}
      {o.fulfilment === 'completed' && (<div style={{ marginTop: 8 }}><b>Rate this order</b><select value={stars} onChange={(e) => setStars(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} stars</option>)}</select><input placeholder="Note (optional)" value={revNote} onChange={(e) => setRevNote(e.target.value)} /><button className="btn-s" onClick={review}>Send stars</button>
        <div style={{ marginTop: 8 }}><b>Report a problem (within 48 hours)</b><input placeholder="What is wrong?" value={prob} onChange={(e) => setProb(e.target.value)} /><button className="btn-s" onClick={report}>Send report</button></div></div>)}
    </div>)}
  </div>);
}
