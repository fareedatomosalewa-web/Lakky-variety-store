'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CartBadge from './cart-badge';

export function SiteHeader() {
  const path = usePathname();
  if (path.startsWith('/admin') || path.startsWith('/staff')) return null;
  return (
    <div className="tophead"><div className="tophead-in">
      <Link href="/" style={{ textDecoration: 'none' }}><span className="brand">Lakky Variety Store</span></Link>
      <span style={{ flex: 1 }} />
      <Link href="/cart" style={{ textDecoration: 'none', background: 'var(--plum)', color: '#fff', borderRadius: 999, padding: '8px 16px', fontWeight: 700 }}>🛒 <CartBadge /></Link>
    </div></div>
  );
}

const tabs = [
  { href: '/', label: 'Home', icon: '🏠', match: (p: string) => p === '/' },
  { href: '/#categories', label: 'Categories', icon: '🗂️', match: (_p: string) => false },
  { href: '/cart', label: 'Cart', icon: '🛒', match: (p: string) => p === '/cart' },
  { href: '/orders', label: 'Track', icon: '📦', match: (p: string) => p.startsWith('/orders') },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith('/admin') || path.startsWith('/staff')) return null;
  return (
    <nav className="bottomnav">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className={t.match(path) ? 'on' : ''}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
        </Link>
      ))}
    </nav>
  );
}
