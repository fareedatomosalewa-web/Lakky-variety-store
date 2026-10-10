'use client';
import { useState } from 'react';
import { trackOrder } from '../../lib/shop-actions';
import { cancelOrder, getMessages, postMessage, requestMoney, setProgress, addReview, reportProblem } from '../../lib/shop-v1';
const CANCEL_REASONS = ['Price too high', 'No longer interested', 'Found it elsewhere', 'Ordered by mistake', 'Other'];
export default function OrdersPage() {
  const [orderId, setOrderId] = useState(''); const [phone, setPhone] = useState(''); const [res, setRes] = useState('');
  const [o, setO] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [reason, setReason] = useState(CANCEL_REASONS[0]); const [note, setNote] = useState('');
  const [stars, setStars] = useState(5); const [revNote, setRevNote] = useState('');
  const [prob, setProb] = useState('');
  const [bank, setBank] = useState({ name: '', number: '', account: '' });
  const loadMsgs = async (id: number) => { const r: any = await getMessages({ orderId: id }).catch(() => null); if (r && r.ok) setMsgs(r.messages); };
  const lookup = async () => {
    if (!orderId || !phone) { setRes('Both Order ID and matching phone are required. Phone alone cannot retrieve.'); return; }
    try {
      const r: any = await trackOrder({ displayId: orderId, phone });
      if (r.ok) {
        setO({ ...r.order, phone });
        const oo = r.order;
        setRes(`Found ${oo.displayId} — ${oo.status} — fulfilment ${oo.fulfilment} — paid ₦${Number(oo.paid).toLocaleString()} of ₦${Number(oo.total).toLocaleString()} — free until ${oo.freeUntil} — fee ₦${Number(oo.fee).toLocaleString()} (${oo.extraDays} days × ₦${Number(oo.rate).toLocaleString()}).`);
        loadMsgs(oo.id);
        return;
      }
    } catch { /* local fallback below */ }
    const last = JSON.parse(localStorage.getItem('lakky-last-proof') || '{}');
    if (last.phone === phone) setRes(`Found: ${orderId} — ${last.status || 'Pending'} — holding countdown + fee shown after confirmation.`);
    else setRes('No match. Check Order ID + phone.');
  };
  const send = async () => {
    if (!draft.trim() || !o) return;
    await postMessage({ orderId: o.id, sender: 'customer', text: draft }).catch(() => null);
    setDraft(''); loadMsgs(o.id);
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
  return (<div><div className="card"><h2>Track orders — ID + phone required</h2>
    <div>Format: LVS-009-9270 (serial + last4 of phone). 5 wrong tries/hour/IP → locked 1 hr. Last4 search supported in admin.</div>
    <input placeholder="Order ID e.g. LVS-001" value={orderId} onChange={e=>setOrderId(e.target.value)} />
    <input placeholder="Phone used at checkout" value={phone} onChange={e=>setPhone(e.target.value)} />
    <button className="btn" onClick={lookup}>Track</button><div>{res}</div></div>
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
