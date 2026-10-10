'use client';
import { useEffect, useState } from 'react';
import { FALLBACK_DESCRIPTION, driveImage, seedAddons, seedProducts, seedSettings } from '../db/seed';
import { discountFor, isNew, isRestocked } from '../lib/pricing';
import { checkAdmin } from '../lib/admin-guard';
const isSet = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '' && !String(v).includes('FILL-IN');
const catsOf = (p: any): string[] => String(p.category || '').split(',').map((c) => c.trim()).filter(Boolean);
const descOf = (p: any) => (p.description && String(p.description).trim() ? p.description : FALLBACK_DESCRIPTION);
export default function Home() {
  const [s, setS] = useState<any>(seedSettings);
  const [isAdmin, setIsAdmin] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [ann, setAnn] = useState('');
  const [minP, setMinP] = useState(''); const [maxP, setMaxP] = useState('');
  const [sort, setSort] = useState('newest');
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('lakky-settings') || 'null');
      if (raw) {
        setS({ ...seedSettings, ...raw });
        if (raw.announcementOn && raw.announcementText) setAnn(raw.announcementText);
      }
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
  const allCats: string[] = [...new Set((seedProducts as any[]).flatMap(catsOf))];
  const needle = q.trim().toLowerCase();
  const base = (seedProducts as any[]).filter((p) =>
    (cat === 'All' || catsOf(p).includes(cat)) &&
    (!needle || p.name.toLowerCase().includes(needle) || descOf(p).toLowerCase().includes(needle) || catsOf(p).join(' ').toLowerCase().includes(needle)) &&
    (!minP || Math.min(...p.variants.map((v: any) => v.price)) >= Number(minP)) &&
    (!maxP || Math.min(...p.variants.map((v: any) => v.price)) <= Number(maxP)));
  const avail = (p: any) => p.variants.some((v: any) => v.available > 0);
  const inStock = base.filter(avail);
  const soldOut = base.filter((p) => !avail(p));
  const sortFn = (a: any, b: any) => {
    const pa = Math.min(...a.variants.map((v: any) => v.price));
    const pb = Math.min(...b.variants.map((v: any) => v.price));
    if (sort === 'low-high') return pa - pb;
    if (sort === 'high-low') return pb - pa;
    return 0;
  };
  const featured = [...inStock, ...soldOut].sort(sortFn);
  const fresh = (seedProducts as any[]).filter((p) => (isNew(p, 7) || isRestocked(p, 2)) && (cat === 'All' || catsOf(p).includes(cat)));
  return (<div>
    {ann ? <div className="card"><b>{ann}</b></div> : null}
    <div className="hero"><h1>Something for every day.</h1><p>Fine things for skin, home, school and style. Pay by bank transfer. Pick up or get delivery.</p><a className="btn" href="#shop" style={{ textDecoration: 'none' }}>Shop now</a></div>
    <div className="searchbar"><input placeholder="Search products… try face masks" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /><button className="btn-s" onClick={() => document.getElementById('shop')?.scrollIntoView()} aria-label="Search">🔍</button></div>
    <div style={{ display: 'flex', gap: 8 }}><input type="number" placeholder="Min ₦" value={minP} onChange={(e) => setMinP(e.target.value)} /><input type="number" placeholder="Max ₦" value={maxP} onChange={(e) => setMaxP(e.target.value)} /><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="low-high">Price low–high</option><option value="high-low">Price high–low</option></select></div>
    <h2 id="categories">Categories</h2>
    <div className="catchips">{['All', ...allCats].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
    <div className="strip">
      <div><b>How it works:</b> 1 Choose → 2 Pay by bank transfer → 3 Upload your receipt, we confirm</div>
      {showFee && <div className="small">Free {s.freeHoldDays}-day hold • Fee ₦{Number(s.globalDailyFee).toLocaleString()}/day after{showNote && <> • {s.pickupNote}</>}</div>}
      <div><a href="/orders">Track your order →</a>{waNumber ? (<span> • <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">WhatsApp us</a></span>) : null}</div>
      {isAdmin && missing.length > 0 && <div className="small">To-do (admin only): set {missing.join(', ')} in Admin Settings.</div>}
    </div>
    <div className="small">Mixed catalogue — no login needed</div>
    <h2 id="shop">Featured products</h2>
    {featured.length === 0 && <div className="empty">Nothing matches that search yet. Try another word.</div>}
    <div className="prod-grid">{featured.map((p) => <ProductCard key={(seedProducts as any[]).indexOf(p)} p={p} />)}</div>
    <h2>New arrivals</h2>
    <div className="prod-grid">{fresh.map((p) => <ProductCard key={'n' + (seedProducts as any[]).indexOf(p)} p={p} />)}</div>
    <div className="card"><h3>Buying plenty for resale?</h3><div className="small">Message us on WhatsApp with your list and we will work it out with you.</div>{waNumber ? <div style={{ marginTop: 8 }}><a className="btn-s" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Chat on WhatsApp</a></div> : null}</div>
    <div className="card"><div><a href="/orders">Track your order →</a> • <a href="/discounts">Discounts</a> • <a href="/wishlist">Saved items</a> • <a href="/signup">Create account</a> • <a href="/login">Log in</a></div><div className="small">Questions? Reach us on WhatsApp or see <a href="/terms">our rules</a>. <a href="/about">About + Help</a>{s.shopHours ? ` • Open: ${s.shopHours}` : ''}</div><div className="small">{((s.socialLinks as any[]) || []).map((l: any, i: number) => { const parts = String(l).split('|'); const name = (parts[0] || l).trim(), url = (parts[1] || '').trim(); return <span key={i}>{i > 0 ? ' • ' : ''}{url ? <a href={url} target="_blank" rel="noreferrer">{name}</a> : name}</span>; })}</div></div>
  </div>);
}

function ProductImage({ p }: { p: any }) {
  const [err, setErr] = useState(false);
  if (p.driveId && !err) return (<div className="prod-img" style={{ padding: 0, overflow: 'hidden' }}><img src={driveImage(p.driveId)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErr(true)} /></div>);
  return <div className="prod-img">{p.emoji || '🛍️'}</div>;
}

function dimsOf(p: any): string[] {
  const keys = new Set<string>();
  for (const v of p.variants) for (const k of Object.keys(v.attrs)) keys.add(k);
  return [...keys];
}

function ProductCard({ p }: { p: any }) {  const dims = dimsOf(p);
  const multi = p.variants.length > 1 && dims.length > 0;
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Record<string, string>>(() => Object.fromEntries(dims.map((d) => [d, p.variants[0].attrs[d]])));
  const [gift, setGift] = useState(false);
  const [added, setAdded] = useState(false);
  const [wished, setWished] = useState(() => {
    try { return (JSON.parse(localStorage.getItem('lakky-wishlist') || '[]') as string[]).includes(p.name); } catch { return false; }
  });
  const wish = () => {
    let list: string[] = [];
    try { list = JSON.parse(localStorage.getItem('lakky-wishlist') || '[]'); } catch { list = []; }
    const has = list.includes(p.name);
    localStorage.setItem('lakky-wishlist', JSON.stringify(has ? list.filter((x) => x !== p.name) : [...list, p.name]));
    setWished(!has);
  };
  const from = Math.min(...p.variants.map((v: any) => v.price));
  const deal = discountFor(p);
  const soldOutCard = !p.variants.some((v: any) => v.available > 0);
  const match = multi
    ? p.variants.find((v: any) => dims.every((d) => String(v.attrs[d]) === String(sel[d])))
    : p.variants[0];
  const lowStock = Math.min(...p.variants.map((v: any) => v.available));
  const showFew = p.lowStockThreshold !== undefined && p.lowStockThreshold !== null && lowStock <= p.lowStockThreshold;
  const add = (v: any) => {
    if (!v || v.available <= 0) return;
    let cart: any[] = [];
    try { cart = JSON.parse(localStorage.getItem('lakky-cart') || '[]'); } catch { cart = []; }
    const label = dims.map((d) => v.attrs[d]).join(' / ');
    const key = `${p.name}|${label}|${gift ? 'gift' : 'no'}`;
    const ex = cart.find((c) => c.key === key);
    if (ex) ex.qty += 1;
    else cart.push({ key, name: p.name, attrs: v.attrs, colour: v.attrs.colour, size: v.attrs.size, price: v.price, addon: gift ? seedAddons[0] : null, qty: 1 });
    localStorage.setItem('lakky-cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('lakky-cart-updated'));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (<div className="prod-card" style={soldOutCard ? { opacity: 0.65 } : undefined}>
    <ProductImage p={p} />
    <div>{isNew(p, 7) ? <span className="badge badge-new">NEW</span> : null}{isRestocked(p, 2) ? <span className="badge">Restocked</span> : null}{showFew ? <span className="badge badge-sale">Few pieces left</span> : null}{soldOutCard ? <span className="badge badge-mut">Sold out</span> : null}</div>
    <div className="prod-name">{p.name} <button onClick={wish} aria-label="Save to wishlist" style={{ background: 'none', border: 0, fontSize: 18, cursor: 'pointer' }}>{wished ? '❤️' : '🤍'}</button></div>
    <div className="small">{descOf(p)}</div>
    {deal
      ? <div><span style={{ textDecoration: 'line-through' }} className="small">₦{from.toLocaleString()}</span> <span className="prod-price">₦{deal.price.toLocaleString()}</span> <span className="badge badge-sale">{deal.label}</span></div>
      : <div className="prod-price">₦{from.toLocaleString()}</div>}
    <div className="small">{catsOf(p).join(' • ')}</div>
    {!multi && <div style={{ marginTop: 6 }}><button className="btn" style={{ width: '100%' }} disabled={match.available <= 0} onClick={() => add(match)}>{added ? 'Added ✓' : 'Add to Cart'}</button></div>}
    {multi && <button className="btn-s" style={{ width: '100%', marginTop: 6 }} onClick={() => setOpen(!open)}>{open ? 'Hide options' : 'Choose options'}</button>}
    {multi && open && (<div style={{ marginTop: 8 }}>
      {dims.map((d) => {
        const opts: string[] = [...new Set((p.variants as any[]).map((v: any) => String(v.attrs[d])))];
        return (<div key={d}><div className="small">{d}</div><div>{opts.map((o) => {
          const v = p.variants.find((x: any) => dims.every((dd) => dd === d ? String(x.attrs[dd]) === o : String(x.attrs[dd]) === String(sel[dd])));
          const off = !v || v.available <= 0;
          return <button key={o} disabled={off} onClick={() => setSel((s) => ({ ...s, [d]: o }))} style={{ margin: 4, border: sel[d] === o ? '2px solid #5A2948' : '1px solid #EBDDD2', borderRadius: 8, padding: '6px 10px', opacity: off ? 0.4 : 1, background: '#fff' }}>{o}{off ? ' — sold out' : ''}</button>;
        })}</div></div>);
      })}
      <div><b>{match && match.available > 0 ? `₦${match.price.toLocaleString()}` : 'Not available in this combination'}</b></div>
      <div><label><input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} /> Gift box +₦{seedAddons[0].price.toLocaleString()}</label></div>
      <button className="btn" style={{ width: '100%' }} disabled={!match || match.available <= 0} onClick={() => add(match)}>{added ? 'Added ✓' : 'Add to Cart'}</button>
    </div>)}
  </div>);
}
