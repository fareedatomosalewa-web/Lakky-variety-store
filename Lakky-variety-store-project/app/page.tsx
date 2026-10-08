'use client';
import { useEffect, useState } from 'react';
import { seedAddons, seedCategories, seedProducts, seedSettings } from '../db/seed';
import { checkAdmin } from '../lib/admin-guard';
const isSet = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '' && !String(v).includes('FILL-IN');
export default function Home() {
  const [s, setS] = useState<any>(seedSettings);
  const [isAdmin, setIsAdmin] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
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
  const matches = (p: any) =>
    (cat === 'All' || p.category === cat) &&
    (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const featured = (seedProducts as any[]).filter(matches);
  const fresh = (seedProducts as any[]).filter((p) => (p.status === 'New' || p.status === 'Restocked') && matches(p));
  return (<div>
    <div className="hero"><h1>Something for every day.</h1><p>Fine things for skin, home, school and style. Pay by bank transfer. Pick up or get delivery.</p><a className="btn" href="#shop" style={{ textDecoration: 'none' }}>Shop now</a></div>
    <div className="searchbar"><input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <h2 id="categories">Categories</h2>
    <div className="catchips">{['All', ...seedCategories].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
    <div className="strip">
      <div><b>How it works:</b> 1 Choose → 2 Pay by bank transfer → 3 Upload your receipt, we confirm</div>
      {showFee && <div className="small">Free {s.freeHoldDays}-day hold • Fee ₦{Number(s.globalDailyFee).toLocaleString()}/day after{showNote && <> • {s.pickupNote}</>}</div>}
      <div><a href="/orders">Track your order →</a>{waNumber ? (<span> • <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">WhatsApp us</a></span>) : null}</div>
      {isAdmin && missing.length > 0 && <div className="small">To-do (admin only): set {missing.join(', ')} in Admin Settings.</div>}
    </div>
    <div className="small">Mixed catalogue — no login needed</div>
    <h2 id="shop">Featured products</h2>
    {featured.length === 0 && <div className="empty">Nothing matches that search yet. Try another word.</div>}
    <div className="prod-grid">{featured.map((p, i) => <ProductCard key={(seedProducts as any[]).indexOf(p)} p={p} />)}</div>
    <h2>New arrivals</h2>
    <div className="prod-grid">{fresh.map((p) => <ProductCard key={'n' + (seedProducts as any[]).indexOf(p)} p={p} />)}</div>
    <div className="card"><h3>Buying plenty for resale?</h3><div className="small">Message us on WhatsApp with your list and we will work it out with you.</div>{waNumber ? <div style={{ marginTop: 8 }}><a className="btn-s" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Chat on WhatsApp</a></div> : null}</div>
    <div className="card"><div><a href="/orders">Track your order →</a></div><div className="small">Questions? Reach us on WhatsApp or see <a href="/terms">our rules</a>.</div></div>
  </div>);
}

function ProductCard({ p }: { p: any }) {
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
  return (<div className="prod-card">
    <div className="prod-img">{p.emoji || '🛍️'}</div>
    <div>{p.badge === 'NEW' ? <span className="badge badge-new">NEW</span> : null}{p.status === 'Restocked' ? <span className="badge">Restocked</span> : null}</div>
    <div className="prod-name">{p.name}</div>
    <div className="prod-price">₦{from.toLocaleString()}</div>
    <div className="small">{p.category}</div>
    <button className="btn-s" style={{ width: '100%', marginTop: 6 }} onClick={() => setOpen(!open)}>{open ? 'Hide options' : 'Choose options'}</button>
    {open && (<div style={{ marginTop: 8 }}>
      <div className="small">Color</div>
      <div>{colours.map((c) => <button key={c} onClick={() => setColour(c)} style={{ margin: 4, border: c === colour ? '2px solid #5A2948' : '1px solid #EBDDD2', borderRadius: 8, padding: '6px 10px', background: '#fff' }}>{c}</button>)}</div>
      <div className="small">Size</div>
      <div>{sizes.map((s) => {
        const v = p.variants.find((x: any) => x.attrs.colour === colour && x.attrs.size === s);
        const off = !v || v.available <= 0;
        return <button key={s} disabled={off} onClick={() => setSize(s)} style={{ margin: 4, border: s === size ? '2px solid #5A2948' : '1px solid #EBDDD2', borderRadius: 8, padding: '6px 10px', opacity: off ? 0.4 : 1, background: '#fff' }}>{s}{off ? ' — 0 left' : ''}</button>;
      })}</div>
      <div><b>{match && match.available > 0 ? `₦${match.price.toLocaleString()} — ${match.available} left` : 'Not available in this combination'}</b></div>
      <div><label><input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} /> Gift box +₦{seedAddons[0].price.toLocaleString()}</label></div>
      <button className="btn" style={{ width: '100%' }} disabled={!match || match.available <= 0} onClick={add}>{added ? 'Added ✓' : 'Add to Cart'}</button>
    </div>)}
  </div>);
}
