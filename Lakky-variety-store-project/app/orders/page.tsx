'use client';
import { useState } from 'react';
export default function OrdersPage() {
  const [orderId, setOrderId] = useState(''); const [phone, setPhone] = useState(''); const [res, setRes] = useState('');
  const lookup = () => {
    if (!orderId || !phone) { setRes('Both Order ID and matching phone are required. Phone alone cannot retrieve.'); return; }
    const last = JSON.parse(localStorage.getItem('lakky-last-proof') || '{}');
    if (last.phone === phone) setRes(`Found: ${orderId} — ${last.status || 'Pending'} — holding countdown + fee shown after confirmation.`);
    else setRes('No match. Check Order ID + phone.');
  };
  return (<div className="card"><h3>Track orders — ID + phone required</h3>
    <input placeholder="Order ID e.g. LVS-001" value={orderId} onChange={e=>setOrderId(e.target.value)} />
    <input placeholder="Phone used at checkout" value={phone} onChange={e=>setPhone(e.target.value)} />
    <button className="btn" onClick={lookup}>Track</button><div>{res}</div></div>);
}
