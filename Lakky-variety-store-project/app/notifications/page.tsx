'use client';
import { useEffect, useState } from 'react';
import { readNotices } from '../../lib/harden';
export default function NoticesPage() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { setList(readNotices()); }, []);
  const cancel = () => {
    const p = JSON.parse(localStorage.getItem('lakky-last-proof') || 'null');
    if (!p) { alert('No order to cancel'); return; }
    localStorage.setItem('lakky-cancel-req', JSON.stringify({ ...p, status: 'cancel-requested' }));
    alert('Cancellation requested. Admin approves → paid converts to Store Credit (non-cashable), stock returns.');
  };
  return (<div><h3>Notifications + Cancellation</h3>
    <button className="btn" onClick={cancel}>Request cancellation (customer)</button>
    {list.length === 0 && <div className="card">No notifications yet. Events: pending, confirmed, under/over, packed, ready, fee approaching/started.</div>}
    {list.map((n, i) => <div className="card" key={i}><b>{n.type}</b> {n.message}<div>{n.at}</div></div>)}
  </div>);
}
