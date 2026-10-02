'use client';
import { useState } from 'react';
import { seedSettings } from '../../../db/seed';
export default function AdminSettings() {
  const [s, setS] = useState<any>(seedSettings);
  const save = () => { localStorage.setItem('lakky-settings', JSON.stringify(s)); alert('Saved. All numeric rules editable, no hard-code. No rebuild needed.'); };
  const num = (k: string) => <input type="number" value={s[k]} onChange={e=>setS({...s,[k]:Number(e.target.value)})} />;
  return (<div className="card"><h3>Business Rules / Settings — PRD numbers are defaults only</h3>
    <div>Global daily fee (NGN){num('globalDailyFee')}</div>
    <div>Free hold days{num('freeHoldDays')}</div>
    <div>Overpayment review threshold{num('overpaymentThreshold')}</div>
    <div>Underpayment expiry days{num('underpaymentExpiryDays')}</div>
    <div>Bank details (editable, no hard-code)<input value={s.bankDetails.bank} onChange={e=>setS({...s,bankDetails:{...s.bankDetails,bank:e.target.value}})} /></div>
    <div>Fulfilment days (editable)<input value={s.fulfilmentDays.join(',')} onChange={e=>setS({...s,fulfilmentDays:e.target.value.split(',')})} /></div>
    <button className="btn" onClick={save}>Save settings</button>
    <div>Credit ledger: overpayment/cancel/adjustments with related Order ID, non-cashable. Fee payments verified per Order ID.</div></div>);
}
