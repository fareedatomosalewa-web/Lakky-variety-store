'use client';
import { useState } from 'react';
import { recordPayment } from '../../../lib/shop-actions';
export default function PayPage({ params }: { params: { ref: string } }) {
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(''); const [ref, setRef] = useState('');
  const submit = async () => {
    const p = JSON.parse(localStorage.getItem('lakky-pending') || '{}');
    try { await recordPayment({ ref: params.ref, amount: Number(amount), date, reference: ref }); } catch { /* local fallback below */ }
    localStorage.setItem('lakky-last-proof', JSON.stringify({ ...p, amount, date, ref, status: 'Payment Confirmation Pending' }));
    localStorage.removeItem('lakky-cart');
    alert('Submitted — ' + params.ref + ' is Pending verification');
    location.href = '/orders';
  };
  return (<div className="card"><h3>Pay {params.ref} — Payment Confirmation Pending after submit</h3>
    <div>Bank: FILL-IN • Acct: FILL-IN • Name: Lakky Variety Store (editable in Admin Settings)</div>
    <input placeholder="Amount you transferred" value={amount} onChange={e=>setAmount(e.target.value)} />
    <input placeholder="Transfer date YYYY-MM-DD" value={date} onChange={e=>setDate(e.target.value)} />
    <input placeholder="Bank reference" value={ref} onChange={e=>setRef(e.target.value)} />
    <input type="file" accept="image/*" /><br/><button className="btn" onClick={submit}>Submit proof</button></div>);
}
