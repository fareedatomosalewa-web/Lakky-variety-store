'use client';
import { useEffect, useState } from 'react';
import { FALLBACK_DESCRIPTION, driveImage, seedProducts } from '../../../db/seed';
import { useCustomerOnly } from '../../../lib/use-customer-only';
import { tierPrice } from '../../../lib/pricing';
import { similarTo } from '../../../lib/categories';
import { listAddons as getAddons, getMedia, logShopEvent } from '../../../lib/shop-v1';
function loadCart(): any[] { try { return JSON.parse(localStorage.getItem('lakky-cart') || '[]'); } catch { return []; } }
function saveCart(cart: any[]) {
  localStorage.setItem('lakky-cart', JSON.stringify(cart));
  window.dispatchEvent(new Event('lakky-cart-updated'));
}
export default function ProductPage({ params }: { params: { id: string } }) {
  useCustomerOnly();
  const p: any = (seedProducts as any[])[Number(params.id)];
  const dims: string[] = p ? [...new Set((p.variants as any[]).flatMap((v: any) => Object.keys(v.attrs)))] : [];
  const [sel, setSel] = useState<Record<string, string>>(() => Object.fromEntries(dims.map((d) => [d, p.variants[0].attrs[d]])));
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const [gi, setGi] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const [wished, setWished] = useState(false);
  const [shared, setShared] = useState(false);
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    try { setLogged(!!JSON.parse(localStorage.getItem('lakky-customer') || '{}').token); } catch { setLogged(false); }
    try { setWished((JSON.parse(localStorage.getItem('lakky-wishlist') || '[]') as string[]).includes(p.name)); } catch { setWished(false); }
  }, []);
  const [extra, setExtra] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [addonIds, setAddonIds] = useState<number[]>([]);
  useEffect(() => {
    getMedia({ productName: p.name }).then((r: any) => { if (r && r.ok) setExtra(r.rows); }).catch(() => {});
    getAddons({ productName: p.name }).then((r: any) => { if (r && r.ok) setAddons(r.rows); }).catch(() => {});
    try {
      const c = JSON.parse(localStorage.getItem('lakky-customer') || 'null');
      logShopEvent({ customerId: c && c.id ? c.id : undefined, kind: 'view', detail: p.name }).catch(() => {});
    } catch { /* logged out */ }
  }, []);
  const [imgErr, setImgErr] = useState(false);
  if (!p) return <div className="empty">That product is gone. <a href="/#shop">Back to the shop →</a></div>;
  const match = p.variants.find((v: any) => dims.every((d) => String(v.attrs[d]) === String(sel[d])));
  const desc = p.description && String(p.description).trim() ? p.description : FALLBACK_DESCRIPTION;
  const showFew = p.lowStockThreshold !== undefined && p.lowStockThreshold !== null &&
    Math.min(...p.variants.map((v: any) => v.available)) <= p.lowStockThreshold;
  const add = () => {
    if (!match || match.available <= 0) { alert('That option is not available right now.'); return; }
    const n = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)));
    const cart = loadCart();
    const label = dims.map((d) => match.attrs[d]).join(' / ');
    const pickedList = addons.filter((a: any) => addonIds.includes(a.id));
    const addonList = pickedList.map((a: any) => ({ name: a.name, price: Number(a.price) }));
    const key = `${p.name}|${label}|${addonList.map((a: any) => a.name).sort().join('+') || 'no'}`;
    const ex = cart.find((c) => c.key === key);
    const unit = tierPrice(p.wholesaleTiers, (ex ? ex.qty : 0) + n, match.price);
    if (ex) { ex.qty += n; ex.price = unit; }
    else cart.push({ key, name: p.name, attrs: match.attrs, colour: match.attrs.colour, size: match.attrs.size, price: unit, addons: addonList, qty: n });
    saveCart(cart);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  const wish = () => {
    let list: string[] = [];
    try { list = JSON.parse(localStorage.getItem('lakky-wishlist') || '[]'); } catch { list = []; }
    const has = list.includes(p.name);
    localStorage.setItem('lakky-wishlist', JSON.stringify(has ? list.filter((x) => x !== p.name) : [...list, p.name]));
    setWished(!has);
  };
  const share = async () => {
    const url = window.location.origin + '/p/' + params.id;
    try {
      if (navigator.share) { await navigator.share({ title: p.name, text: p.name, url }); return; }
      throw new Error('no-share');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch { /* ignore */ }
    }
  };
  const tiers = (() => { try { const t = typeof p.wholesaleTiers === 'string' ? JSON.parse(p.wholesaleTiers) : p.wholesaleTiers; return Array.isArray(t) ? t : []; } catch { return []; } })();
  const gallery: string[] = [
    ...(p.driveId && !imgErr ? [driveImage(p.driveId)] : []),
    ...extra.filter((m: any) => !String(m.url).match(/\.(mp4|webm)$/i)).map((m: any) => m.url),
  ];
  const videos = extra.filter((m: any) => String(m.url).match(/\.(mp4|webm)$/i));
  const show = (d: number) => setGi((g) => (gallery.length ? (g + d + gallery.length) % gallery.length : 0));
  const pickedAddon = addons.filter((a: any) => addonIds.includes(a.id));
  const pickedTotal = pickedAddon.reduce((s: number, a: any) => s + Number(a.price), 0);
  const sims = similarTo(seedProducts as any[], p, 4);
  const simIdx = (s: any) => (seedProducts as any[]).indexOf(s);
  return (<div>
  <div className="card">
    {gallery.length > 0
      ? <div>
        <div className="prod-img" style={{ padding: 0, overflow: 'hidden', height: 300, position: 'relative' }}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (dx < -30) show(1); else if (dx > 30) show(-1); setTouchX(null); }}>
          <img src={gallery[Math.min(gi, gallery.length - 1)]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          {gallery.length > 1 && (<span><button className="btn-s" aria-label="Previous photo" onClick={() => show(-1)} style={{ position: 'absolute', left: 8, top: '45%', minHeight: 0, padding: '8px 12px' }}>‹</button><button className="btn-s" aria-label="Next photo" onClick={() => show(1)} style={{ position: 'absolute', right: 8, top: '45%', minHeight: 0, padding: '8px 12px' }}>›</button></span>)}
        </div>
        {gallery.length > 1 && <div className="small" style={{ textAlign: 'center' }}>Swipe left / right • {Math.min(gi, gallery.length - 1) + 1} of {gallery.length}</div>}
      </div>
      : <div className="prod-img" style={{ height: 300 }}>{p.emoji || '🛍️'}</div>}
    {videos.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{videos.map((m: any, i: number) => <video key={i} src={m.url} controls controlsList="nodownload" style={{ maxWidth: '100%', borderRadius: 10 }} />)}</div>}
    <div>{p.badge === 'NEW' ? <span className="badge badge-new">NEW</span> : null}{p.status === 'Restocked' ? <span className="badge">Restocked</span> : null}{showFew ? <span className="badge badge-sale">Few pieces left</span> : null}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h2 style={{ margin: '8px 0', flex: 1 }}>{p.name}</h2><button onClick={wish} aria-label="Save to wishlist" style={{ background: 'none', border: 0, fontSize: 24, cursor: 'pointer' }}>{wished ? '❤️' : '🤍'}</button><button className="btn-s" onClick={share} style={{ minHeight: 0 }}>{shared ? 'Link copied ✓' : 'Share'}</button></div>
    <div className="small">{desc}</div>
    {dims.map((d) => {
      const opts: string[] = [...new Set((p.variants as any[]).map((v: any) => String(v.attrs[d])))];
      if (opts.length < 2) return null;
      return (<div key={d}><div className="small">{d === 'Colour' ? 'Color' : d}</div><div>{opts.map((o) => {
        const v = p.variants.find((x: any) => dims.every((dd) => dd === d ? String(x.attrs[dd]) === o : String(x.attrs[dd]) === String(sel[dd])));
        const off = !v || v.available <= 0;
        return <button key={o} disabled={off} onClick={() => setSel((s) => ({ ...s, [d]: o }))} style={{ margin: 4, border: sel[d] === o ? '2px solid #5A2948' : '1px solid #EBDDD2', borderRadius: 8, padding: '6px 10px', opacity: off ? 0.4 : 1, background: '#fff' }}>{o}{off ? ' — sold out' : ''}</button>;
      })}</div></div>);
    })}
    <div><b>{match ? (match.available > 0 ? `₦${(match.price + pickedTotal).toLocaleString()}` : 'Not available in this combination') : 'Not available in this combination'}</b></div>
    {addons.length > 0 && (<div style={{ marginTop: 6 }}><div className="small">Add-ons for this item (tick all you want)</div>{addons.map((a: any) => <div key={a.id}><label><input type="checkbox" checked={addonIds.includes(a.id)} onChange={(e) => setAddonIds((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))} /> {a.name} +₦{Number(a.price).toLocaleString()}{Number(a.stock) <= 0 ? ' — Unavailable' : ''}</label></div>)}</div>)}
    {tiers.length > 0 && (<div style={{ marginTop: 6 }}><div className="small">Buy more, pay less each</div><table><tbody>{tiers.map((t: any, i: number) => <tr key={i}><td>{t.min}{t.max ? `–${t.max}` : '+'}</td><td>₦{Number(t.each).toLocaleString()} each</td></tr>)}</tbody></table></div>)}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}><button className="btn-s" onClick={() => setQty(Math.max(1, (Math.floor(Number(qty) || 1)) - 1))}>−</button><input type="number" min={1} max={999} value={qty} onChange={(e) => setQty(e.target.value as unknown as number)} style={{ width: 70, textAlign: 'center' }} /><button className="btn-s" onClick={() => setQty(Math.min(999, (Math.floor(Number(qty) || 1)) + 1))}>+</button></div>
    {logged ? <button className="btn" onClick={add}>{added ? 'Added ✓' : 'Add to Cart'}</button> : <a className="btn-s" href="/login" style={{ textDecoration: 'none' }}>Log in to buy</a>}</div>
  {sims.length > 0 && (<div className="card"><h3>Similar items</h3><div className="prod-grid">{sims.map((s: any) => (
    <a key={s.name} href={'/p/' + simIdx(s)} style={{ textDecoration: 'none', color: 'inherit' }}><div className="prod-card">
      {s.driveId ? <div className="prod-img" style={{ padding: 0, overflow: 'hidden' }}><img src={driveImage(s.driveId)} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div> : <div className="prod-img">{s.emoji || '🛍️'}</div>}
      <div className="prod-name">{s.name}</div>
      <div className="prod-price">₦{Math.min(...s.variants.map((v: any) => v.price)).toLocaleString()}</div>
    </div></a>))}</div></div>)}
  </div>);
}
