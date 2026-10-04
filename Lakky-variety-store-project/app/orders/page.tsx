'use client';
import { useState } from 'react';
import { trackOrder } from '../../lib/shop-actions';
export default function OrdersPage() {
  const [orderId, setOrderId] = useState(''); const [phone, setPhone] = useState(''); const [res, setRes] = useState('');
  const lookup = async () => {
    if (!orderId || !phone) { setRes('Both Order ID and matching phone are required. Phone alone cannot retrieve.'); return; }
    try {
      const r: any = await trackOrder({ displayId: orderId, phone });
      if (r.ok) {
        const o = r.order;
        setRes(`Found ${o.displayId} — ${o.status} — fulfilment ${o.fulfilment} — paid ₦${Number(o.paid).toLocaleString()} of ₦${Number(o.total).toLocaleString()} — free until ${o.freeUntil} — fee ₦${Number(o.fee).toLocaleString()} (${o.extraDays} days × ₦${Number(o.rate).toLocaleString()}).`);
        return;
      }
    } catch { /* local fallback below */ }
    const last = JSON.parse(localStorage.getItem('lakky-last-proof') || '{}');
    if (last.phone === phone) setRes(`Found: ${orderId} — ${last.status || 'Pending'} — holding countdown + fee shown after confirmation.`);
    else setRes('No match. Check Order ID + phone.');
  };
  return (<div className="card"><h3>Track orders — ID + phone required</h3>
    <div>Format: LVS-009-9270 (serial + last4 of phone). 5 wrong tries/hour/IP → locked 1 hr. Last4 search supported in admin.</div>
    <input placeholder="Order ID e.g. LVS-001" value={orderId} onChange={e=>setOrderId(e.target.value)} />
    <input placeholder="Phone used at checkout" value={phone} onChange={e=>setPhone(e.target.value)} />
    <button className="btn" onClick={lookup}>Track</button><div>{res}</div></div>);
}
