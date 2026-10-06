'use client';
import { useEffect, useState } from 'react';
import { seedSettings } from '../../../db/seed';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { getSettings, saveSettings } from '../../../lib/shop-actions';
export default function AdminSettings() {
  const allowed = useAdminGuard();
  const [s, setS] = useState<any>(seedSettings);
  const [src, setSrc] = useState('local defaults');
  useEffect(() => {
    getSettings().then((r: any) => {
      if (r.ok) {
        setS({ ...seedSettings, ...r.settings, bankDetails: r.settings.bankDetails || (seedSettings as any).bankDetails, fulfilmentDays: r.settings.fulfilmentDays || (seedSettings as any).fulfilmentDays });
        setSrc('Supabase (live)');
      }
    });
  }, []);
  const save = async () => {
    const r: any = await saveSettings({ bankDetails: s.bankDetails, globalDailyFee: s.globalDailyFee, freeHoldDays: s.freeHoldDays, overpaymentThreshold: s.overpaymentThreshold, underpaymentExpiryDays: s.underpaymentExpiryDays, abandonDays: s.abandonDays, fulfilmentDays: s.fulfilmentDays, pickupNote: s.pickupNote });
    localStorage.setItem('lakky-settings', JSON.stringify(s));
    alert(r.ok ? 'Saved to Supabase (live).' : 'Saved locally only — Supabase unreachable, will retry.');
    if (r.ok) setSrc('Supabase (live)');
  };
  const num = (k: string) => <input type="number" value={s[k]} onChange={e=>setS({...s,[k]:Number(e.target.value)})} />;
  if (!allowed) return <div className="card">Checking admin session…</div>;
  return (<div className="card"><h3>Business Rules / Settings — PRD numbers are defaults only</h3>
    <div className="small">Source: {src}</div>
    <div>Global daily fee (NGN){num('globalDailyFee')}</div>
    <div>Free hold days{num('freeHoldDays')}</div>
    <div>Overpayment review threshold{num('overpaymentThreshold')}</div>
    <div>Underpayment expiry days{num('underpaymentExpiryDays')}</div>
    <div>Abandon days (fee unpaid + no contact){num('abandonDays')}</div>
    <div>Bank details (editable, no hard-code)<input value={s.bankDetails.bank} onChange={e=>setS({...s,bankDetails:{...s.bankDetails,bank:e.target.value}})} /></div>
    <div>Fulfilment days (editable)<input value={s.fulfilmentDays.join(',')} onChange={e=>setS({...s,fulfilmentDays:e.target.value.split(',')})} /></div>
    <button className="btn" onClick={save}>Save settings</button>
    <div>Credit ledger: overpayment/cancel/adjustments with related Order ID, non-cashable. Fee payments verified per Order ID.</div></div>);
}
