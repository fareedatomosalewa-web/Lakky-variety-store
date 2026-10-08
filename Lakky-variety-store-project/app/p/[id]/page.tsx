'use client';
import { useState } from 'react';
import { seedProducts, seedAddons } from '../../../db/seed';
function loadCart(): any[] { try { return JSON.parse(localStorage.getItem('lakky-cart') || '[]'); } catch { return []; } }
function saveCart(cart: any[]) {
  localStorage.setItem('lakky-cart', JSON.stringify(cart));
  window.dispatchEvent(new Event('lakky-cart-updated'));
}
export default function ProductPage({ params }: { params: { id: string } }) {
  const p: any = (seedProducts as any[])[Number(params.id)];
  const [colour, setColour] = useState(p.variants[0].attrs.colour);
  const [size, setSize] = useState(p.variants[0].attrs.size);
  const [addon, setAddon] = useState(false);
  const [added, setAdded] = useState(false);
  if (!p) return <div>Not found</div>;
  const colours: string[] = [...new Set((p.variants as any[]).map((v: any) => v.attrs.colour))];
  const sizes: string[] = [...new Set((p.variants as any[]).map((v: any) => v.attrs.size))];
  const match = p.variants.find(v => v.attrs.colour === colour && v.attrs.size === size);
  const add = () => {
    if (!match || match.available <= 0) { alert('Variant unavailable'); return; }
    const cart = loadCart();
    const key = `${p.name}|${colour}|${size}|${addon ? 'gift' : 'no'}`;
    const ex = cart.find(c => c.key === key);
    if (ex) ex.qty += 1; else cart.push({ key, name: p.name, colour, size, price: match.price, addon: addon ? seedAddons[0] : null, qty: 1 });
    saveCart(cart);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (<div className="card">
    <div className="prod-img">{p.emoji || '🛍️'}</div>
    <div>{p.badge === 'NEW' ? <span className="badge badge-new">NEW</span> : null}{p.status === 'Restocked' ? <span className="badge">Restocked</span> : null}</div>
    <h3>{p.name}</h3><div className="small">{p.category} • {p.description}</div>
    <div>Color: {colours.map(c => <button key={c} onClick={() => setColour(c)} style={{margin:4,border:c===colour?'2px solid #5A2948':'1px solid #EBDDD2',borderRadius:8,padding:'6px 10px',background:'#fff'}}>{c}</button>)}</div>
    <div>Size: {sizes.map(s => <button key={s} onClick={() => setSize(s)} style={{margin:4,border:s===size?'2px solid #5A2948':'1px solid #EBDDD2',borderRadius:8,padding:'6px 10px',background:'#fff'}}>{s}</button>)}</div>
    <div>{match ? (match.available > 0 ? <b>₦{match.price.toLocaleString()} — {match.available} left</b> : <b style={{color:'#B94A48'}}>Unavailable combination</b>) : <b style={{color:'#B94A48'}}>Unavailable combination</b>}</div>
    <label><input type="checkbox" checked={addon} onChange={e => setAddon(e.target.checked)} /> Gift box +₦{seedAddons[0].price.toLocaleString()}</label><br/>
    <button className="btn" onClick={add}>{added ? 'Added ✓' : 'Add to Cart'}</button></div>);
}
