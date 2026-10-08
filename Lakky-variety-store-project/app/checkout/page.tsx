'use client';
import { useEffect, useState } from 'react';
import { createPending } from '../../lib/shop-actions';
import { seedSettings } from '../../db/seed';
export default function CheckoutPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('Pickup'); const [area, setArea] = useState('');
  const [day, setDay] = useState('');
  const [days, setDays] = useState<string[]>((seedSettings as any).fulfilmentDays || []);
  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('lakky-cart') || '[]'));
    try {
      const raw = JSON.parse(localStorage.getItem('lakky-settings') || 'null');
      if (raw && raw.fulfilmentDays) setDays(raw.fulfilmentDays);
    } catch { /* seed defaults */ }
  }, []);
  const total = cart.reduce((s, l) => s + (l.price + (l.addon ? l.addon.price : 0)) * l.qty, 0);
  const submit = async () => {
    if (!name || !phone) { alert('Please type your full name and an active phone number.'); return; }
    const lines = cart.map((l: any) => ({ attrs: { colour: l.colour, size: l.size }, price: l.price, qty: l.qty, addon: l.addon }));
    try {
      const r: any = await createPending({ name, phone, method, area, day, agreedAt: '', lines, total });
      if (r.ok) {
        localStorage.setItem('lakky-pending', JSON.stringify({ ref: r.ref, pendingId: r.pendingId, name, phone, method, area, day, total, live: true }));
        location.href = '/pay/' + r.ref;
        return;
      }
    } catch { /* fall through to local demo ref */ }
    const ref = 'P-2026-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('lakky-pending', JSON.stringify({ ref, name, phone, method, area, day, total }));
    location.href = '/pay/' + ref;
  };
  return (<div className="card"><h2>Checkout — you will pay ₦{total.toLocaleString()} on the next page</h2>
    <input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
    <input placeholder="Active phone number, like +234..." value={phone} onChange={e=>setPhone(e.target.value)} />
    <select value={method} onChange={e=>setMethod(e.target.value)}><option>Pickup</option><option>Delivery</option></select>
    {method==='Delivery' && <input placeholder="Area, address and a landmark near you" value={area} onChange={e=>setArea(e.target.value)} />}
    <div className="small">Preferred day</div>
    <select value={day} onChange={e=>setDay(e.target.value)}><option value="">Any day is fine</option>{days.map((d) => <option key={d} value={d}>{d}</option>)}</select>
    <button className="btn" onClick={submit}>Continue to payment →</button></div>);
}

