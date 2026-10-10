'use client';
import { useEffect, useState } from 'react';
import { seedProducts } from '../../db/seed';
import { discountFor } from '../../lib/pricing';
import { listDiscounted } from '../../lib/shop-v1';
export default function DiscountsPage() {
  const [live, setLive] = useState<any[]>([]);
  useEffect(() => { listDiscounted().then((r: any) => { if (r && r.ok) setLive(r.rows); }).catch(() => {}); }, []);
  const seeds = (seedProducts as any[]).map((p, i) => ({ ...p, deal: discountFor(p), index: i })).filter((p) => p.deal);
  return (<div><h2>Discounts</h2>
    {live.length === 0 && seeds.length === 0 && <div className="empty">No discounts right now. Check back soon.</div>}
    <div className="prod-grid">
      {live.map((p: any) => <div key={'l' + p.id} className="prod-card"><div className="prod-name">{p.name}</div><div><span className="prod-price">₦{Number(p.base_price).toLocaleString()}</span> <span className="badge badge-sale">On sale</span></div><div className="small">{p.category}</div></div>)}
      {seeds.map((p: any) => <div key={'s' + p.index} className="prod-card"><div className="prod-name">{p.name}</div><div><span style={{ textDecoration: 'line-through' }} className="small">₦{Math.min(...p.variants.map((v: any) => v.price)).toLocaleString()}</span> <span className="prod-price">₦{p.deal.price.toLocaleString()}</span> <span className="badge badge-sale">{p.deal.label}</span></div><div><a className="btn-s" href={`/p/${p.index}`}>View →</a></div></div>)}
    </div></div>);
}
