'use client';
import { useEffect, useState } from 'react';
import { seedProducts, seedAddons, seedSettings } from '../db/seed';
import { checkAdmin } from '../lib/admin-guard';
const isSet = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '' && !String(v).includes('FILL-IN');
export default function Home() {
  const [s, setS] = useState<any>(seedSettings);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('lakky-settings') || 'null');
      if (raw) setS({ ...seedSettings, ...raw });
    } catch { /* keep seed defaults from Settings */ }
    checkAdmin().then((r: any) => setIsAdmin(!!r.ok)).catch(() => {});
  }, []);
  const waNumber = String((s as any).whatsapp || (s.bankDetails as any)?.phone || '').replace(/\D/g, '');
  const showFee = Number(s.freeHoldDays) > 0 && Number(s.globalDailyFee) > 0;
  const showNote = isSet(s.pickupNote);
  const missing = [
    !showFee && 'hold days / daily fee',
    !showNote && 'pickup note',
    !waNumber && 'WhatsApp number',
  ].filter(Boolean) as string[];
  return (<div>
    <div className="strip">
      <div><b>How it works:</b> 1 Choose → 2 Pay by bank transfer → 3 Upload proof, we confirm</div>
      {showFee && <div className="small">Free {s.freeHoldDays}-day hold • Fee ₦{Number(s.globalDailyFee).toLocaleString()}/day after{showNote && <> • {s.pickupNote}</>}</div>}
      <div><a href="/orders">Track your order →</a>{waNumber ? (<span> • <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">WhatsApp us</a></span>) : null}</div>
      {isAdmin && missing.length > 0 && <div className="small">To-do (admin only): set {missing.join(', ')} in Admin Settings.</div>}
    </div>
    <h2>Mixed catalogue — no login needed</h2>
    {seedProducts.map((p, i) => <ProductCard key={i} index={i} p={p as any} />)}
  </div>);
}

function ProductCard({ index, p }: { index: number; p: any }) {
  const [open, setOpen] = useState(false);
  const [colour, setColour] = useState(p.variants[0].attrs.colour);
  const [size, setSize] = useState(p.variants[0].attrs.size);
  const [gift, setGift] = useState(false);
  const [added, setAdded] = useState(false);
  const from = Math.min(...p.variants.map((v: any) => v.price));
  const match = p.variants.find((v: any) => v.attrs.colour === colour && v.attrs.size === size);
  const colours: string[] = [...new Set((p.variants as any[]).map((v: any) => v.attrs.colour))];
  const sizes: string[] = [...new Set((p.variants as any[]).map((v: any) => v.attrs.size))];
  const add = () => {
    if (!match || match.available <= 0) return;
    let cart: any[] = [];
    try { cart = JSON.parse(localStorage.getItem('lakky-cart') || '[]'); } catch { cart = []; }
    const key = `${p.name}|${colour}|${size}|${gift ? 'gift' : 'no'}`;
    const ex = cart.find((c) => c.key === key);
    if (ex) ex.qty += 1;
    else cart.push({ key, name: p.name, colour, size, price: match.price, addon: gift ? seedAddons[0] : null, qty: 1 });
    localStorage.setItem('lakky-cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('lakky-cart-updated'));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (<div className="card"><b>{p.name}</b> <span className="badge">New</span><div>From ₦{from.toLocaleString()}</div>
    <button className="btn" onClick={() => setOpen(!open)}>{open ? 'Hide options' : 'Choose options'}</button>
    {open && (<div style={{ marginTop: 8 }}>
      <div className="small">Color</div>
      <div>{colours.map((c) => <button key={c} onClick={() => setColour(c)} style={{ margin: 4, border: c === colour ? '2px solid #0F766E' : '1px solid #ccc', borderRadius: 8, padding: '6px 10px' }}>{c}</button>)}</div>
      <div className="small">Size</div>
      <div>{sizes.map((s) => {
        const v = p.variants.find((x: any) => x.attrs.colour === colour && x.attrs.size === s);
        const off = !v || v.available <= 0;
        return <button key={s} disabled={off} onClick={() => setSize(s)} style={{ margin: 4, border: s === size ? '2px solid #0F766E' : '1px solid #ccc', borderRadius: 8, padding: '6px 10px', opacity: off ? 0.4 : 1 }}>{s}{off ? ' — 0 left' : ''}</button>;
      })}</div>
      <div><b>{match && match.available > 0 ? `₦${match.price.toLocaleString()} — ${match.available} left` : 'Not available in this combination'}</b></div>
      <div><label><input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} /> Gift box +₦{seedAddons[0].price.toLocaleString()}</label></div>
      <button className="btn" disabled={!match || match.available <= 0} onClick={add}>{added ? 'Added ✓' : 'Add to Cart'}</button>
    </div>)}
  </div>);
}
