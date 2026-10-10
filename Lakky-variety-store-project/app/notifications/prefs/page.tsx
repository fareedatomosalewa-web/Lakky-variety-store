'use client';
import { useEffect, useState } from 'react';
import { setPref } from '../../../lib/shop-v1';
const TYPES = ['order updates', 'fee reminders', 'stockpile reminders', 'wishlist alerts', 'promos'];
export default function PrefsPage() {
  const [id, setId] = useState<number | null>(null);
  const [off, setOff] = useState<string[]>([]);
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('lakky-customer') || 'null');
      if (c && c.id) setId(c.id);
      setOff(JSON.parse(localStorage.getItem('lakky-notif-off') || '[]'));
    } catch { /* logged out */ }
  }, []);
  const toggle = async (t: string) => {
    const next = off.includes(t) ? off.filter((x) => x !== t) : [...off, t];
    setOff(next);
    localStorage.setItem('lakky-notif-off', JSON.stringify(next));
    if (id) await setPref({ customerId: id, type: t, off: next.includes(t) }).catch(() => null);
  };
  return (<div className="card"><h2>Notification settings</h2>
    <div className="small">Turn off any type. Missed updates from turned-off notices are your responsibility — order status is always visible here when you open the app.</div>
    {TYPES.map((t) => <div key={t}><label><input type="checkbox" style={{ width: 'auto' }} checked={!off.includes(t)} onChange={() => toggle(t)} /> {t}</label></div>)}
    {!id && <div className="small"><a href="/signup">Create an account</a> to save these on all devices.</div>}</div>);
}
