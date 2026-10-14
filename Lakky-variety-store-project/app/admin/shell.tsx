'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '../../lib/auth-client';
import { adminInbox } from '../../lib/shop-v1';
import { pushReady, savePushSubscription } from '../../lib/push';

const NAV = [
  { href: '/admin', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/settings', label: 'Settings' },
];

const VISIT_KEY = 'lakky-admin-visit';

function AdminBanner() {
  const [items, setItems] = useState<any[]>([]);
  const visit = () => {
    try { return localStorage.getItem(VISIT_KEY) || new Date(Date.now() - 24 * 3600000).toISOString(); } catch { return new Date(Date.now() - 24 * 3600000).toISOString(); }
  };
  const check = async () => {
    const r: any = await adminInbox({ sinceIso: visit() }).catch(() => null);
    if (!r || !r.ok) return;
    const list: any[] = [
      ...(r.messages || []).map((m: any) => ({ kind: 'msg', label: m.displayId, sub: `${m.name || 'Customer'}: ${String(m.text).slice(0, 80)}` })),
      ...(r.orders || []).map((o: any) => ({ kind: 'order', label: o.displayId, sub: `${o.name || 'Customer'} — ₦${Number(o.total).toLocaleString()}` })),
      ...(r.receipts || []).map((s: any) => ({ kind: 'receipt', label: s.displayId, sub: `${s.name || 'Customer'} claimed ₦${Number(s.amount).toLocaleString()}` })),
    ];
    setItems(list.slice(0, 10));
  };
  useEffect(() => {
    check();
    const t = setInterval(check, 25000);
    return () => clearInterval(t);
  }, []);
  if (!items.length) return null;
  const icon = (k: string) => (k === 'msg' ? '💬' : k === 'order' ? '🆕' : '🧾');
  const touch = () => { try { localStorage.setItem(VISIT_KEY, new Date().toISOString()); } catch { /* ignore */ } };
  return (<div className="card" style={{ borderLeft: '4px solid var(--plum)' }}>
    <b>Needs your attention ({items.length})</b>
    {items.map((it, i) => <div key={i} className="small"><a href={`/admin/orders/${encodeURIComponent(it.label)}`} onClick={touch}>{icon(it.kind)} {it.label}</a> — {it.sub}</div>)}
    <div style={{ marginTop: 6 }}><button className="btn-s" onClick={() => { touch(); setItems([]); }}>Mark all seen</button></div>
  </div>);
}

function NotifyMe() {
  const [state, setState] = useState('');
  useEffect(() => {
    pushReady().then((r: any) => {
      if (r && !r.ready) setState('keys-missing');
    }).catch(() => {});
  }, []);
  const go = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return; }
      const reg = await navigator.serviceWorker.ready;
      const r: any = await pushReady().catch(() => null);
      if (!r || !r.ready || !r.publicKey) { setState('keys-missing'); return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('blocked'); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: r.publicKey });
      const j = sub.toJSON();
      const s: any = await savePushSubscription({ endpoint: sub.endpoint, p256dh: j.keys?.p256dh || '', auth: j.keys?.auth || '' }).catch(() => null);
      setState(s && s.ok ? 'on' : 'failed');
    } catch { setState('failed'); }
  };
  if (state === 'on') return <div className="small" style={{ color: '#E8CFC2' }}>🔔 This phone will buzz</div>;
  return (<div>
    <button onClick={go} style={{ background: 'rgba(255,255,255,.16)', border: 0, color: '#fff', cursor: 'pointer', textAlign: 'left', padding: '10px 12px', borderRadius: 9, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', width: '100%' }}>🔔 Notify me on this phone</button>
    {state === 'keys-missing' && <div className="small" style={{ color: '#E8CFC2' }}>Push keys not added yet — the banner above still watches.</div>}
    {state === 'blocked' && <div className="small" style={{ color: '#E8CFC2' }}>Notifications blocked — allow them in your browser settings, then tap again.</div>}
    {state === 'failed' && <div className="small" style={{ color: '#E8CFC2' }}>Could not switch on — try again.</div>}
    {state === 'unsupported' && <div className="small" style={{ color: '#E8CFC2' }}>This browser can't do push — the banner above still watches.</div>}
  </div>);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const out = async () => {
    try { await authClient.signOut(); } catch { /* ignore */ }
    router.replace('/admin/login');
  };
  return (<div className="adminwrap">
    <aside className="sidebar">
      <div className="brand" style={{ color: '#fff' }}>Lakky Admin</div>
      <nav>
        {NAV.map((n) => <Link key={n.href} href={n.href} className={path === n.href ? 'on' : ''}>{n.label}</Link>)}
        <button onClick={out} style={{ background: 'none', border: 0, color: '#E8CFC2', cursor: 'pointer', textAlign: 'left', padding: '10px 12px', fontSize: 15, fontFamily: 'inherit' }}>Log out</button>
      </nav>
      <div style={{ marginTop: 10 }}><NotifyMe /></div>
    </aside>
    <div className="adminmain"><AdminBanner />{children}</div>
  </div>);
}
