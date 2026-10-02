'use client';
import { useState } from 'react';
import { seedProducts, seedAddons } from '../../../db/seed';
function loadCart(): any[] { try { return JSON.parse(localStorage.getItem('lakky-cart') || '[]'); } catch { return []; } }
export default function ProductPage({ params }: { params: { id: string } }) {
  const p: any = (seedProducts as any[])[Number(params.id)];
  const [colour, setColour] = useState(p.variants[0].attrs.colour);
  const [size, setSize] = useState(p.variants[0].attrs.size);
  const [addon, setAddon] = useState(false);
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
    localStorage.setItem('lakky-cart', JSON.stringify(cart));
    alert('Added — staying on page. Cart updated.');
  };
  return (<div className="card"><h3>{p.name}</h3>
    <div>Colour: {colours.map(c => <button key={c} onClick={() => setColour(c)} style={{margin:4,border:c===colour?'2px solid #0F766E':'1px solid #ccc',borderRadius:8,padding:'6px 10px'}}>{c}</button>)}</div>
    <div>Size: {sizes.map(s => <button key={s} onClick={() => setSize(s)} style={{margin:4,border:s===size?'2px solid #0F766E':'1px solid #ccc',borderRadius:8,padding:'6px 10px'}}>{s}</button>)}</div>
    <div>{match ? (match.available > 0 ? <b>₦{match.price.toLocaleString()} — {match.available} left</b> : <b style={{color:'red'}}>Unavailable combination</b>) : <b style={{color:'red'}}>Unavailable combination</b>}</div>
    <label><input type="checkbox" checked={addon} onChange={e => setAddon(e.target.checked)} /> Gift box +₦{seedAddons[0].price.toLocaleString()}</label><br/>
    <button className="btn" onClick={add}>Add to Cart</button></div>);
}
