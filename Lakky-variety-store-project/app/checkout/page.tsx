'use client';
import { useEffect, useState } from 'react';
import { createPending } from '../../lib/shop-actions';
import { quoteWithCredit } from '../../lib/shop-v1';
import { seedSettings } from '../../db/seed';
const custKey = () => { try { return JSON.parse(localStorage.getItem('lakky-customer') || 'null'); } catch { return null; } };
export default function CheckoutPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('Pickup'); const [area, setArea] = useState('');
  const [day, setDay] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<any>(null);
  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('lakky-cart') || '[]'));
    const c = custKey();
    if (c) { setName(c.name || ''); setPhone(c.phone || ''); }
    try {
      const raw = JSON.parse(localStorage.getItem('lakky-settings') || 'null');
      if (raw && raw.fulfilmentDays) setDays(raw.fulfilmentDays);
    } catch { /* seed defaults */ }
  }, []);
  const total = cart.reduce((s, l) => s + (l.price + (l.addon ? l.addon.price : 0)) * l.qty, 0);
  useEffect(() => {
    if (!phone || !total) { setQuote(null); return; }
    quoteWithCredit({ phone, total, coupon: coupon || undefined }).then((r: any) => setQuote(r.ok ? r : null)).catch(() => setQuote(null));
  }, [phone, total, coupon]);
  const toPay = quote ? quote.toPay : total;
  const shortcuts = ['Today', 'Tomorrow', 'Day after tomorrow'];
  const submit = async () => {
    if (!name || !phone) { alert('Please type your full name and an active phone number.'); return; }
    if (method === 'Stockpile' && !day) { alert('Please pick a fulfilment date for stockpile.'); }
    const lines = cart.map((l: any) => ({ attrs: l.attrs || { colour: l.colour, size: l.size }, price: l.price, qty: l.qty, addon: l.addon }));
    try {
      const r: any = await createPending({ name, phone, method, area, day, agreedAt: '', lines, total });
      if (r.ok) {
        localStorage.setItem('lakky-pending', JSON.stringify({ ref: r.ref, pendingId: r.pendingId, name, phone, method, area, day, total, creditUsed: quote ? quote.used : 0, coupon, live: true }));
        location.href = '/pay/' + r.ref;
        return;
      }
    } catch { /* fall through to local demo ref */ }
    const ref = 'P-2026-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('lakky-pending', JSON.stringify({ ref, name, phone, method, area, day, total, creditUsed: quote ? quote.used : 0, coupon }));
    location.href = '/pay/' + ref;
  };
  return (<div className="card"><h2>Checkout</h2>
    <div className="small">Items ₦{total.toLocaleString()}{quote && quote.used > 0 && <> • store credit applied ₦{quote.used.toLocaleString()}</>}{quote && quote.couponOff > 0 && <> • coupon −₦{quote.couponOff.toLocaleString()}</>}</div>
    <div><b>You will pay ₦{toPay.toLocaleString()} on the next page</b></div>
    <input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
    <input placeholder="Active phone number, like +234..." value={phone} onChange={e=>setPhone(e.target.value)} />
    <select value={method} onChange={e=>setMethod(e.target.value)}><option>Pickup</option><option>Delivery</option><option>Stockpile</option></select>
    {method==='Delivery' && <><input placeholder="Area, address and a landmark near you" value={area} onChange={e=>setArea(e.target.value)} /><div className="small">Delivery fee is calculated separately and differs by location. You will be contacted for the delivery fee.</div></>}
    {method==='Stockpile' && <div className="small">You pay now and collect later. Free days and daily fees are in <a href="/terms" target="_blank" rel="noreferrer">our rules</a>.</div>}
    <div className="small">Preferred day</div>
    <div>{shortcuts.map((d) => <button key={d} className="btn-s" style={{ marginRight: 6 }} onClick={() => setDay(d)}>{d}</button>)}</div>
    <select value={day} onChange={e=>setDay(e.target.value)}><option value="">Pick a date{method==='Pickup' ? ' (within 1 week, longer needs Stockpile)' : ''}</option>{days.map((d) => <option key={d} value={d}>{d}</option>)}</select>
    <input placeholder="Coupon code (optional)" value={coupon} onChange={e=>setCoupon(e.target.value)} />
    <button className="btn" onClick={submit}>Continue to payment →</button></div>);
}
