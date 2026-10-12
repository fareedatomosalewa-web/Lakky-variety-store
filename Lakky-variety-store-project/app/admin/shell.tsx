'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';

const NAV = [
  { href: '/admin', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/reports', label: 'Reports' },
];

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
    </aside>
    <div className="adminmain">{children}</div>
  </div>);
}
