'use client';
import { useEffect, useState } from 'react';
import { setPref } from '../../../lib/shop-v1';
import { customerPushReady } from '../../../lib/customer-push';
import { pushSupported, permissionState, subscribeThisDevice, unsubscribeThisDevice, currentEndpoint } from '../../../lib/customer-push-client';
const TYPES = ['order updates', 'fee reminders', 'stockpile reminders', 'wishlist alerts', 'promos'];
export default function PrefsPage() {
  const [id, setId] = useState<number | null>(null);
  const [token, setToken] = useState('');
  const [off, setOff] = useState<string[]>([]);
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [perm, setPerm] = useState('default');

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('lakky-customer') || 'null');
      if (c && c.id) setId(c.id);
      if (c && c.token) setToken(String(c.token));
      setOff(JSON.parse(localStorage.getItem('lakky-notif-off') || '[]'));
    } catch { /* logged out */ }
    setSupported(pushSupported());
    setPerm(permissionState());
    customerPushReady().then((r: any) => setReady(Boolean(r && r.ready))).catch(() => {}).finally(() => setLoaded(true));
    currentEndpoint().then((e) => setEndpoint(e)).catch(() => {});
  }, []);

  const toggle = async (t: string) => {
    const next = off.includes(t) ? off.filter((x) => x !== t) : [...off, t];
    setOff(next);
    localStorage.setItem('lakky-notif-off', JSON.stringify(next));
    if (id) await setPref({ customerId: id, type: t, off: next.includes(t) }).catch(() => null);
  };

  const switchOn = async () => {
    setMsg('');
    if (!token) { setMsg('Please log in first.'); return; }
    setBusy(true);
    const r = await subscribeThisDevice(token);
    setBusy(false);
    setPerm(permissionState());
    if (r.ok) { setEndpoint(await currentEndpoint()); setMsg('Phone notifications are ON for this device.'); return; }
    setMsg(
      r.reason === 'denied' || r.reason === 'blocked' ? 'Your browser blocked notifications. Open your browser settings for this site, allow notifications, then try again.'
        : r.reason === 'not-configured' ? 'Phone notifications are not switched on for the shop yet. Please try again later.'
          : r.reason === 'unsupported' ? 'This browser cannot do phone notifications. On iPhone, add the shop to your Home Screen first (see below).'
            : 'Could not switch on. Please try again.',
    );
  };

  const switchOff = async () => {
    setBusy(true);
    await unsubscribeThisDevice(token);
    setBusy(false);
    setEndpoint(null);
    setMsg('Phone notifications are OFF for this device.');
  };

  return (<div>
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Phone notifications</h2>
      {!loaded && <div className="small">Checking this device…</div>}
      {loaded && !supported && <div className="small">This browser cannot show phone notifications. On iPhone, open the shop in Safari, tap Share, then <b>Add to Home Screen</b>, and open it from that icon.</div>}
      {loaded && supported && !ready && <div className="small">Phone notifications are not switched on for the shop yet. Please check back later.</div>}
      {loaded && supported && ready && (<>
        <div className="small" style={{ color: 'var(--ink)', fontSize: 14 }}>
          We will send order updates to this device: confirmed, packed, on the way and ready for pickup.
          You can switch it off any time; the shop still works normally.
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`badge ${endpoint ? 'badge-ok' : 'badge-mut'}`}>{endpoint ? 'ON for this device' : 'OFF for this device'}</span>
          {endpoint
            ? <button className="btn-d" onClick={switchOff} disabled={busy}>{busy ? 'Switching off…' : 'Turn off'}</button>
            : <button className="btn" onClick={switchOn} disabled={busy}>{busy ? 'Switching on…' : 'Turn on notifications'}</button>}
        </div>
        {perm === 'denied' && <div className="small" style={{ marginTop: 8 }}>Your browser has blocked notifications for this site. Allow them in the browser settings, then try again.</div>}
      </>)}
      {msg && <div className="small" style={{ marginTop: 8, color: 'var(--plum)', fontWeight: 600 }}>{msg}</div>}
      <div className="small" style={{ marginTop: 10 }}>
        <b>Tip:</b> for reliable notifications, install the shop on your phone: on Android tap the browser menu → <b>Install app</b>; on iPhone use Safari → Share → <b>Add to Home Screen</b>. iPhone needs iOS 16.4 or newer.
      </div>
      {loaded && !token && <div className="small" style={{ marginTop: 6 }}><a href="/login">Log in</a> to switch on phone notifications.</div>}
    </div>

    <div className="card"><h2 style={{ marginTop: 0 }}>Notification types</h2>
      <div className="small">Turn off any type. Missed updates from turned-off notices are your responsibility — order status is always visible here when you open the app.</div>
      {TYPES.map((t) => <div key={t}><label><input type="checkbox" style={{ width: 'auto' }} checked={!off.includes(t)} onChange={() => toggle(t)} /> {t}</label></div>)}
      {loaded && !id && <div className="small"><a href="/signup">Create an account</a> to save these on all devices.</div>}
    </div>
  </div>);
}
