'use client';
import { useEffect, useState } from 'react';
import { seedProducts, seedSettings } from '../db/seed';
import { checkAdmin } from '../lib/admin-guard';
const isSet = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '' && !String(v).includes('FILL-IN');
export default function Home() {
  const [s, setS] = useState<any>(seedSettings);
  const [isAdmin, setIsAdmin] = useState(false);
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
  return (<div>
    <div className="strip">
      <div><b>How it works:</b> 1 Choose → 2 Pay by bank transfer → 3 Upload proof, we confirm</div>
      {showFee && <div className="small">Free {s.freeHoldDays}-day hold • Fee ₦{Number(s.globalDailyFee).toLocaleString()}/day after{showNote && <> • {s.pickupNote}</>}</div>}
      <div><a href="/orders">Track your order →</a>{waNumber ? (<span> • <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">WhatsApp us</a></span>) : null}</div>
      {isAdmin && missing.length > 0 && <div className="small">To-do (admin only): set {missing.join(', ')} in Admin Settings.</div>}
    </div>
    <h2>Mixed catalogue — no login needed</h2>
    {seedProducts.map((p, i) => {
      const from = Math.min(...p.variants.map(v => v.price));
      return (<div className="card" key={i}><b>{p.name}</b> <span className="badge">New</span><div>From ₦{from.toLocaleString()}</div><a href={`/p/${i}`}>View variants →</a></div>);
    })}
  </div>);
}
