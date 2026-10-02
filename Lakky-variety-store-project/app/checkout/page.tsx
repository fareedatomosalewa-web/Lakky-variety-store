'use client';
import { useEffect, useState } from 'react';
export default function CheckoutPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('Pickup'); const [area, setArea] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setCart(JSON.parse(localStorage.getItem('lakky-cart') || '[]')); }, []);
  const total = cart.reduce((s, l) => s + (l.price + (l.addon ? l.addon.price : 0)) * l.qty, 0);
  const submit = () => {
    if (!name || !phone) { alert('Full name + active phone required'); return; }
    if (!confirmed) { alert('Confirm the Expected Transfer amount first'); return; }
    const ref = 'P-2026-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('lakky-pending', JSON.stringify({ ref, name, phone, method, area, total }));
    location.href = '/pay/' + ref;
  };
  return (<div className="card"><h3>Checkout — Expected Transfer ₦{total.toLocaleString()}</h3>
    <input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
    <input placeholder="Active phone +234..." value={phone} onChange={e=>setPhone(e.target.value)} />
    <select value={method} onChange={e=>setMethod(e.target.value)}><option>Pickup</option><option>Delivery</option></select>
    {method==='Delivery' && <input placeholder="Location/area + address + landmark" value={area} onChange={e=>setArea(e.target.value)} />}
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /> I confirm I will transfer exactly ₦{total.toLocaleString()}</label><br/>
    <button className="btn" onClick={submit}>Continue to payment →</button></div>);
}
