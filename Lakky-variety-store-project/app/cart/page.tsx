'use client';
import { useCustomerOnly } from '../../lib/use-customer-only';
import { useEffect, useState } from 'react';
export default function CartPage() {
  useCustomerOnly();
  const [cart, setCart] = useState<any[]>([]);
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem('lakky-cart') || '[]'));
    try { setLogged(!!JSON.parse(localStorage.getItem('lakky-customer') || '{}').token); } catch { setLogged(false); }
  }, []);
  const save = (c: any[]) => { setCart(c); localStorage.setItem('lakky-cart', JSON.stringify(c)); window.dispatchEvent(new Event('lakky-cart-updated')); };
  const adsOf = (l: any): any[] => (l.addons || (l.addon ? [l.addon] : []));
  const lineUnit = (l: any) => l.price + adsOf(l).reduce((s: number, a: any) => s + Number(a.price), 0);
  const total = cart.reduce((s, l) => s + lineUnit(l) * l.qty, 0);
  if (!cart.length) return (<div><h2>Your cart</h2><div className="empty">Your cart is empty. <a href="/#shop">Find something you'll love →</a></div></div>);
  if (!logged) return (<div><h2>Your cart</h2><div className="empty">Please <a href="/login">log in</a> or <a href="/signup">create an account</a> to shop. You can keep looking at photos and prices.</div></div>);
  return (<div><h2>Your cart</h2><div className="small">Live total ₦{total.toLocaleString()}</div>
    {cart.map((l, i) => <div className="card" key={i}><b>{l.name}</b> <span className="small">{l.attrs ? Object.values(l.attrs).join(' / ') : `${l.colour || ''} ${l.size || ''}`.trim()}{adsOf(l).length ? ` + ${adsOf(l).map((a: any) => a.name).join(' + ')}` : ''}</span><div className="prod-price">₦{(lineUnit(l) * l.qty).toLocaleString()}</div><div className="small">{l.qty} × ₦{lineUnit(l).toLocaleString()}</div>
    <button className="btn-s" onClick={() => { const c=[...cart]; c[i].qty+=1; save(c); }}>+</button> <input type="number" min={1} max={999} value={l.qty} onChange={(e) => { const c=[...cart]; const n=Math.max(1,Math.min(999,Math.floor(Number(e.target.value)||1))); c[i].qty=n; save(c); }} style={{ width: 64, textAlign: 'center' }} /> <button className="btn-s" onClick={() => { const c=[...cart]; c[i].qty=Math.max(1,c[i].qty-1); save(c); }}>-</button> <button className="btn-d" onClick={() => save(cart.filter((_,j)=>j!==i))}>Remove</button></div>)}
    <div><a className="btn" href="/checkout" style={{ textDecoration: 'none' }}>Proceed to checkout →</a> <a href="/">Continue shopping</a></div></div>);
}
