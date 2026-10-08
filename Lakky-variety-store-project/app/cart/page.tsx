'use client';
import { useEffect, useState } from 'react';
export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);
  useEffect(() => { setCart(JSON.parse(localStorage.getItem('lakky-cart') || '[]')); }, []);
  const save = (c: any[]) => { setCart(c); localStorage.setItem('lakky-cart', JSON.stringify(c)); window.dispatchEvent(new Event('lakky-cart-updated')); };
  const total = cart.reduce((s, l) => s + (l.price + (l.addon ? l.addon.price : 0)) * l.qty, 0);
  if (!cart.length) return (<div><h2>Your cart</h2><div className="empty">Your cart is empty. <a href="/#shop">Find something you'll love →</a></div></div>);
  return (<div><h2>Your cart</h2><div className="small">Live total ₦{total.toLocaleString()}</div>
    {cart.map((l, i) => <div className="card" key={i}><b>{l.name}</b> <span className="small">{l.colour} {l.size}{l.addon ? ' + Gift box' : ''}</span><div className="prod-price">₦{((l.price + (l.addon ? l.addon.price : 0)) * l.qty).toLocaleString()}</div><div className="small">{l.qty} × ₦{(l.price + (l.addon ? l.addon.price : 0)).toLocaleString()}</div>
    <button className="btn-s" onClick={() => { const c=[...cart]; c[i].qty+=1; save(c); }}>+</button> <button className="btn-s" onClick={() => { const c=[...cart]; c[i].qty=Math.max(1,c[i].qty-1); save(c); }}>-</button> <button className="btn-d" onClick={() => save(cart.filter((_,j)=>j!==i))}>Remove</button></div>)}
    <div><a className="btn" href="/checkout" style={{ textDecoration: 'none' }}>Proceed to checkout →</a> <a href="/">Continue shopping</a></div></div>);
}
