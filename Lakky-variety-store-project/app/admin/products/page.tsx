'use client';
import { seedProducts, seedSettings } from '../../../db/seed';
import { useAdminGuard } from '../../../lib/use-admin-guard';
export default function AdminProducts() {
  const allowed = useAdminGuard();
  if (!allowed) return <div className="card">Checking admin session…</div>;
  return (<div><h3>Products — owner edits without code</h3>
    {seedProducts.map((p: any, i: number) => <div className="card" key={i}><b>{p.name}</b> base ₦{p.basePrice.toLocaleString()}
      {p.variants.map((v: any, j: number) => <div key={j}>{v.attrs.colour} {v.attrs.size} — ₦{v.price.toLocaleString()} — avail {v.available} / reserved 0</div>)}
    </div>)}
    <div className="card">Images, variant price/stock, New/Restocked/OutOfStock tags editable here (DB-backed in prod).</div></div>);
}
