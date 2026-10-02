'use client';
import { useEffect, useState } from 'react';
export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);
  useEffect(() => { setCart(JSON.parse(localStorage.getItem('lakky-cart') || '[]')); }, []);
  const save = (c: any[]) => { setCart(c); localStorage.setItem('lakky-cart', JSON.stringify(c)); };
  const total = cart.reduce((s, l) => s + (l.price + (l.addon ? l.addon.price : 0)) * l.qty, 0);
  return (<div><h3>Cart — live total ₦{total.toLocaleString()}</h3>
    {cart.map((l, i) => <div className="card" key={i}><b>{l.name}</b> {l.colour} {l.size} {l.addon ? '+ Gift box' : ''}<div>₦{((l.price + (l.addon ? l.addon.price : 0)) * l.qty).toLocaleString()} ({l.qty} × ₦{(l.price + (l.addon ? l.addon.price : 0)).toLocaleString()})</div>
    <button onClick={() => { const c=[...cart]; c[i].qty+=1; save(c); }}>+</button> <button onClick={() => { const c=[...cart]; c[i].qty=Math.max(1,c[i].qty-1); save(c); }}>-</button> <button onClick={() => save(cart.filter((_,j)=>j!==i))}>Remove</button></div>)}
    <a className="btn" href="/checkout">Proceed to checkout →</a> <a href="/">Continue shopping</a></div>);
}
