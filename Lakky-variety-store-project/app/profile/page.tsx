'use client';
import { useEffect, useState } from 'react';
import { useCustomerOnly } from '../../lib/use-customer-only';

export default function ProfilePage() {
  useCustomerOnly();
  const [c, setC] = useState<any>(null);
  useEffect(() => {
    try { setC(JSON.parse(localStorage.getItem('lakky-customer') || 'null')); } catch { setC(null); }
  }, []);
  const out = () => {
    try { localStorage.removeItem('lakky-customer'); } catch { /* ignore */ }
    location.href = '/';
  };
  if (!c || !c.token) return (<div className="card"><h2>Profile</h2><div>You are not logged in.</div><div style={{ marginTop: 8 }}><a className="btn" href="/login" style={{ textDecoration: 'none' }}>Log in</a> <a className="btn-s" href="/signup" style={{ textDecoration: 'none' }}>Create account</a></div></div>);
  return (<div>
    <div className="card"><h2>Profile</h2>
      <div><b>{c.name || 'Customer'}</b></div>
      <div className="small">{c.phone || ''}{c.email ? ` • ${c.email}` : ''}</div>
    </div>
    <div className="card">
      <div><a href="/orders">Track your orders →</a></div>
      <div><a href="/wishlist">Saved items →</a></div>
      <div><a href="/notifications">Notifications →</a></div>
    </div>
    <div className="card"><button className="btn-s" onClick={out}>Log out</button></div>
  </div>);
}
