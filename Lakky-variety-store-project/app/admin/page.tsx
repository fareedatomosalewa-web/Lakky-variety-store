'use client';
import { useEffect, useState } from 'react';
import { useAdminGuard } from '../../lib/use-admin-guard';
export default function AdminDash() {
  const allowed = useAdminGuard();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!allowed) return;
    const p = JSON.parse(localStorage.getItem('lakky-last-proof') || 'null');
    setItems(p && p.ref ? [{ ...p, id: p.ref }] : []);
  }, [allowed]);
  if (!allowed) return <div className="card">Checking admin session…</div>;
  return (<div><h3>Admin queue — Pending first</h3>
    <div><a href="/admin/products">Products</a> | <a href="/admin/settings">Settings / Business Rules</a> | <a href="/admin/reports">Reports + CSV</a></div>
    {items.length === 0 && <div className="card">No pending proofs yet. Submit one via storefront Pay page.</div>}
    {items.map((o) => <div className="card" key={o.id}><b>{o.id}</b> • {o.name} • {o.phone} • Expected ₦{(o.total||0).toLocaleString()} • Claimed ₦{o.amount} <span className="badge">Pending</span><br/><a className="btn" href={`/admin/orders/${o.id}`}>Open order detail →</a></div>)}
  </div>);
}
