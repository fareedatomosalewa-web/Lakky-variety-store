'use client';
import { useEffect, useState } from 'react';
import { seedProducts } from '../../db/seed';
export default function WishlistPage() {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    try { setNames(JSON.parse(localStorage.getItem('lakky-wishlist') || '[]')); } catch { setNames([]); }
  }, []);
  const items = (seedProducts as any[]).map((p, i) => ({ ...p, index: i })).filter((p) => names.includes(p.name));
  return (<div><h2>Saved items</h2>
    <div className="small">Saving does NOT keep stock for you — an item can sell out.</div>
    {items.length === 0 && <div className="empty">Nothing saved yet. Tap 🤍 on anything you like.</div>}
    <div className="prod-grid">{items.map((p: any) => <div key={p.index} className="prod-card"><div className="prod-name">{p.name}</div><div className="prod-price">₦{Math.min(...p.variants.map((v: any) => v.price)).toLocaleString()}</div><div><a className="btn-s" href={`/p/${p.index}`}>View →</a></div></div>)}</div></div>);
}
