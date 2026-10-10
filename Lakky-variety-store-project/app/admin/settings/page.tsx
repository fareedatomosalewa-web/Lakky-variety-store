'use client';
import { useEffect, useState } from 'react';
import { seedSettings } from '../../../db/seed';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { getSettings, saveSettings } from '../../../lib/shop-actions';
const DEFAULTS: any = {
  ...seedSettings, stockpileFeePerDay: 50, maxStockpileDays: 60, creditCashMinimum: 5000,
  restockTagDays: 2, newTagDays: 7, reportWindowHours: 48, reminderFirstDays: 2, reminderEveryDays: 2,
  pickupLocation: '', pickupReveal: false, shopHours: '', announcementOn: false, announcementText: '',
  socialLinks: [], aboutText: '', helpText: '',
};
export default function AdminSettings() {
  const allowed = useAdminGuard();
  const [s, setS] = useState<any>(DEFAULTS);
  const [src, setSrc] = useState('local defaults');
  useEffect(() => {
    getSettings().then((r: any) => {
      if (r.ok) {
        setS({ ...DEFAULTS, ...r.settings, bankDetails: r.settings.bankDetails || (seedSettings as any).bankDetails, fulfilmentDays: r.settings.fulfilmentDays || (seedSettings as any).fulfilmentDays });
        setSrc('Supabase (live)');
      }
    });
  }, []);
  const save = async () => {
    const keys = ['bankDetails', 'globalDailyFee', 'freeHoldDays', 'overpaymentThreshold', 'underpaymentExpiryDays', 'abandonDays', 'fulfilmentDays', 'pickupNote', 'stockpileFeePerDay', 'maxStockpileDays', 'creditCashMinimum', 'restockTagDays', 'newTagDays', 'reportWindowHours', 'reminderFirstDays', 'reminderEveryDays', 'pickupLocation', 'pickupReveal', 'shopHours', 'announcementOn', 'announcementText', 'socialLinks', 'aboutText', 'helpText'];
    const patch: any = {};
    for (const k of keys) patch[k] = (s as any)[k];
    const r: any = await saveSettings(patch);
    localStorage.setItem('lakky-settings', JSON.stringify(s));
    alert(r.ok ? 'Saved to Supabase (live).' : 'Saved locally only — Supabase unreachable, will retry.');
    if (r.ok) setSrc('Supabase (live)');
  };
  const num = (k: string) => <input type="number" value={Number((s as any)[k] ?? 0)} onChange={e=>setS({...s,[k]:Number(e.target.value)})} />;
  const txt = (k: string, ph?: string) => <input placeholder={ph || ''} value={String((s as any)[k] ?? '')} onChange={e=>setS({...s,[k]:e.target.value})} />;
  const area = (k: string, ph?: string) => <textarea placeholder={ph || ''} value={String((s as any)[k] ?? '')} onChange={e=>setS({...s,[k]:e.target.value})} />;
  const chk = (k: string, label: string) => <div><label><input type="checkbox" style={{ width: 'auto' }} checked={!!(s as any)[k]} onChange={e=>setS({...s,[k]:e.target.checked})} /> {label}</label></div>;
  if (!allowed) return <div className="card">Checking admin session…</div>;
  return (<div className="card"><h2>Business Rules / Settings — everything here needs no code</h2>
    <div className="small">Source: {src}</div>
    <h3>Money</h3>
    <div>Global daily fee (NGN){num('globalDailyFee')}</div>
    <div>Stockpile fee per day (NGN){num('stockpileFeePerDay')}</div>
    <div>Free hold days{num('freeHoldDays')}</div>
    <div>Max stockpile days{num('maxStockpileDays')}</div>
    <div>Overpayment review threshold{num('overpaymentThreshold')}</div>
    <div>Underpayment expiry days{num('underpaymentExpiryDays')}</div>
    <div>Abandon days (fee unpaid + no contact){num('abandonDays')}</div>
    <div>Credit-to-cash minimum (NGN){num('creditCashMinimum')}</div>
    <h3>Shop content</h3>
    <div>Bank name<input value={s.bankDetails.bank} onChange={e=>setS({...s,bankDetails:{...s.bankDetails,bank:e.target.value}})} /></div>
    <div>Account number<input value={s.bankDetails.accountNumber} onChange={e=>setS({...s,bankDetails:{...s.bankDetails,accountNumber:e.target.value}})} /></div>
    <div>Account name<input value={s.bankDetails.accountName} onChange={e=>setS({...s,bankDetails:{...s.bankDetails,accountName:e.target.value}})} /></div>
    <div>Pickup location (hidden unless revealed){txt('pickupLocation', 'One pickup point')}</div>
    {chk('pickupReveal', 'Show pickup location to customers')}
    <div>Shop opening hours{txt('shopHours', 'e.g. Mon–Sat, 9am–6pm')}</div>
    {chk('announcementOn', 'Show announcement banner')}
    <div>Announcement text{txt('announcementText', 'e.g. Closed on public holidays')}</div>
    <div>Social links (one per line: name | url)<textarea placeholder="" value={((s as any).socialLinks || []).join('\n')} onChange={(e) => setS({ ...s, socialLinks: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })} /></div>
    <div>Fulfilment days (comma list)<input value={(s.fulfilmentDays || []).join(',')} onChange={e=>setS({...s,fulfilmentDays:e.target.value.split(',')})} /></div>
    <div>Pickup note{txt('pickupNote')}</div>
    <div>About the shop{area('aboutText')}</div>
    <div>Help / Contact text{area('helpText')}</div>
    <h3>Tags and windows</h3>
    <div>Restocked tag days{num('restockTagDays')}</div>
    <div>NEW tag days{num('newTagDays')}</div>
    <div>Report-a-problem window (hours){num('reportWindowHours')}</div>
    <div>Reminder first after (days){num('reminderFirstDays')}</div>
    <div>Reminder every (days){num('reminderEveryDays')}</div>
    <button className="btn" onClick={save}>Save settings</button>
    <div className="small">Credit: all balance applies first at checkout; cash-out from minimum; never expires.</div></div>);
}
