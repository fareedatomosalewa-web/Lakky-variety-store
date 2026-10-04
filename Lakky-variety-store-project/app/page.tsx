'use client';
import { useEffect, useState } from 'react';
import { seedProducts, seedSettings } from '../db/seed';
export default function Home() {
  const [s, setS] = useState<any>(seedSettings);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('lakky-settings') || 'null');
      if (raw) setS({ ...seedSettings, ...raw });
    } catch { /* keep seed defaults from Settings */ }
  }, []);
  const waNumber = String((s as any).whatsapp || (s.bankDetails as any)?.phone || '').replace(/\D/g, '');
  return (<div>
    <div className="strip">
      <div><b>How it works:</b> 1 Choose → 2 Pay by transfer → 3 Upload proof, we confirm</div>
      <div className="small">Free {s.freeHoldDays}-day hold • Fee ₦{Number(s.globalDailyFee).toLocaleString()}/day after • {s.pickupNote}</div>
      <div><a href="/orders">Track your order →</a>{waNumber ? (<span> • <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">WhatsApp us</a></span>) : (<span className="small"> • WhatsApp number set in Admin Settings</span>)}</div>
    </div>
    <h2>Mixed catalogue — no login needed</h2>
    {seedProducts.map((p, i) => {
      const from = Math.min(...p.variants.map(v => v.price));
      return (<div className="card" key={i}><b>{p.name}</b> <span className="badge">New</span><div>From ₦{from.toLocaleString()}</div><a href={`/p/${i}`}>View variants →</a></div>);
    })}
  </div>);
}
