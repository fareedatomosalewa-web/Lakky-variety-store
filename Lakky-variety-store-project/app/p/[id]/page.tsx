'use client';
import { useState } from 'react';
import { FALLBACK_DESCRIPTION, driveImage, seedAddons, seedProducts } from '../../../db/seed';
function loadCart(): any[] { try { return JSON.parse(localStorage.getItem('lakky-cart') || '[]'); } catch { return []; } }
function saveCart(cart: any[]) {
  localStorage.setItem('lakky-cart', JSON.stringify(cart));
  window.dispatchEvent(new Event('lakky-cart-updated'));
}
export default function ProductPage({ params }: { params: { id: string } }) {
  const p: any = (seedProducts as any[])[Number(params.id)];
  const dims: string[] = p ? [...new Set((p.variants as any[]).flatMap((v: any) => Object.keys(v.attrs)))] : [];
  const [sel, setSel] = useState<Record<string, string>>(() => Object.fromEntries(dims.map((d) => [d, p.variants[0].attrs[d]])));
  const [addon, setAddon] = useState(false);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
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
    const key = `${p.name}|${label}|${addon ? 'gift' : 'no'}`;
    const ex = cart.find((c) => c.key === key);
    if (ex) ex.qty += n;
    else cart.push({ key, name: p.name, attrs: match.attrs, colour: match.attrs.colour, size: match.attrs.size, price: match.price, addon: addon ? seedAddons[0] : null, qty: n });
    saveCart(cart);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (<div className="card">
    {p.driveId && !imgErr
      ? <div className="prod-img" style={{ padding: 0, overflow: 'hidden', height: 220 }}><img src={driveImage(p.driveId)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} /></div>
      : <div className="prod-img" style={{ height: 220 }}>{p.emoji || '🛍️'}</div>}
    <div>{p.badge === 'NEW' ? <span className="badge badge-new">NEW</span> : null}{p.status === 'Restocked' ? <span className="badge">Restocked</span> : null}{showFew ? <span className="badge badge-sale">Few pieces left</span> : null}</div>
    <h2>{p.name}</h2><div className="small">{desc}</div>
    {dims.map((d) => {
      const opts: string[] = [...new Set((p.variants as any[]).map((v: any) => String(v.attrs[d])))];
      if (opts.length < 2) return null;
      return (<div key={d}><div className="small">{d === 'Colour' ? 'Color' : d}</div><div>{opts.map((o) => {
        const v = p.variants.find((x: any) => dims.every((dd) => dd === d ? String(x.attrs[dd]) === o : String(x.attrs[dd]) === String(sel[dd])));
        const off = !v || v.available <= 0;
        return <button key={o} disabled={off} onClick={() => setSel((s) => ({ ...s, [d]: o }))} style={{ margin: 4, border: sel[d] === o ? '2px solid #5A2948' : '1px solid #EBDDD2', borderRadius: 8, padding: '6px 10px', opacity: off ? 0.4 : 1, background: '#fff' }}>{o}{off ? ' — sold out' : ''}</button>;
      })}</div></div>);
    })}
    <div><b>{match ? (match.available > 0 ? `₦${match.price.toLocaleString()}` : 'Not available in this combination') : 'Not available in this combination'}</b></div>
    <label><input type="checkbox" checked={addon} onChange={(e) => setAddon(e.target.checked)} /> Gift box +₦{seedAddons[0].price.toLocaleString()}</label><br/>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}><button className="btn-s" onClick={() => setQty(Math.max(1, (Math.floor(Number(qty) || 1)) - 1))}>−</button><input type="number" min={1} max={999} value={qty} onChange={(e) => setQty(e.target.value as unknown as number)} style={{ width: 70, textAlign: 'center' }} /><button className="btn-s" onClick={() => setQty(Math.min(999, (Math.floor(Number(qty) || 1)) + 1))}>+</button></div>
    <button className="btn" onClick={add}>{added ? 'Added ✓' : 'Add to Cart'}</button></div>);
}
