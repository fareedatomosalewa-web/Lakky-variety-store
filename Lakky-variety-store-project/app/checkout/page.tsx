'use client';
import { useEffect, useState } from 'react';
import { createPending } from '../../lib/shop-actions';
import { ensureReference } from '../../lib/shop-v1';
import { quoteWithCredit } from '../../lib/shop-v1';
import { seedSettings } from '../../db/seed';
import Steps from './steps';
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
  const submit = async () => {
    if (!name || !phone) { alert('Please type your full name and an active phone number.'); return; }
    let token = '';
    try { token = JSON.parse(localStorage.getItem('lakky-customer') || '{}').token || ''; } catch { token = ''; }
    if (!token) { alert('Please log in or create an account first.'); location.href = '/login'; return; }
    if (method === 'Pickup' && day && !['Today', 'Tomorrow', 'Day after tomorrow', ''].includes(day)) {
      alert('Pickup must be within 1 week. For a later date, please choose Stockpile below.');
      return;
    }
    if (method === 'Stockpile' && !day) { alert('Please pick a fulfilment date for stockpile.'); }
    const lines = cart.map((l: any) => ({ attrs: l.attrs || { colour: l.colour, size: l.size }, price: l.price, qty: l.qty, addon: l.addon }));
    try {
      const r: any = await createPending({ name, phone, method, area, day, agreedAt: '', lines, total, creditApplied: quote ? quote.used : 0, couponCode: coupon || undefined, token });
      if (r.ok) {
        const payTotal = typeof r.total === 'number' ? r.total : total;
        let code = r.ref;
        try {
          const rr: any = await ensureReference({ pendingRef: r.ref });
          if (rr.ok) code = rr.referenceId;
        } catch { /* internal ref stays */ }
        localStorage.setItem('lakky-pending', JSON.stringify({ ref: code, pendingId: r.pendingId, name, phone, method, area, day, total: payTotal, creditUsed: quote ? quote.used : 0, coupon, live: true }));
        location.href = '/pay/' + code;
        return;
      }
      if (r.reason === 'login-required') { alert('Please log in or create an account first.'); location.href = '/login'; return; }
      alert('Could not reach the shop database. Your order was NOT created. Check your connection and try again.');
      return;
    } catch { alert('Could not reach the shop database. Your order was NOT created. Check your connection and try again.'); return; }
  };
  return (<div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><a href="/cart" style={{ textDecoration: 'none', fontSize: 20 }}>←</a><h2 style={{ margin: 0 }}>Checkout</h2></div>
    <Steps step={2} />
    <div className="card"><div className="small" style={{ fontWeight: 700 }}>YOUR DETAILS</div>
      <input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
      <input placeholder="0803 123 4567" value={phone} onChange={e=>setPhone(e.target.value)} />
      <div className="small">We’ll use this number to update you in the app and to track your order.</div></div>
    <div className="card"><div className="small" style={{ fontWeight: 700 }}>HOW DO YOU WANT IT?</div>
      <div className="seg">
        {['Pickup', 'Delivery'].map((m) => <button key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{m}</button>)}
      </div>
      <div><button className="btn-s" style={{ border: 0, paddingLeft: 0 }} onClick={() => setMethod('Stockpile')}>Need more time? {method === 'Stockpile' ? '✓ Stockpile picked' : 'Choose Stockpile →'}</button></div>
      {method==='Delivery' && <><input placeholder="Area, address and a landmark near you" value={area} onChange={e=>setArea(e.target.value)} /><div className="small">Delivery fee is calculated separately and differs by location. You will be contacted for the delivery fee.</div></>}
      {method==='Stockpile' && <div className="small">You pay now and collect later. Free days and daily fees are in <a href="/terms" target="_blank" rel="noreferrer">our rules</a>.</div>}
      <div className="small">Preferred day</div>
      <select value={day} onChange={e=>setDay(e.target.value)}><option value="">Pick a day{method==='Pickup' ? ' (within 1 week)' : ''}</option><option>Today</option><option>Tomorrow</option><option>Day after tomorrow</option>{days.map((d) => <option key={d} value={d}>{d}</option>)}</select>
    </div>
    <div className="card"><div className="small" style={{ fontWeight: 700 }}>ORDER SUMMARY</div>
      {cart.map((l: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l.name} × {l.qty}</span><b>₦{((l.price + (l.addon ? l.addon.price : 0)) * l.qty).toLocaleString()}</b></div>)}
      {quote && quote.used > 0 && <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Store credit</span><span>−₦{quote.used.toLocaleString()}</span></div>}
      {quote && quote.couponOff > 0 && <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Coupon</span><span>−₦{quote.couponOff.toLocaleString()}</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8 }}><b>Total</b><b>₦{toPay.toLocaleString()}</b></div>
      <input placeholder="Coupon code (optional)" value={coupon} onChange={e=>setCoupon(e.target.value)} />
    </div>
    <button className="btn" style={{ width: '100%' }} onClick={submit}>Continue to payment →</button></div>);
}
