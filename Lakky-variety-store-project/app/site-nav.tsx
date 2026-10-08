'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CartBadge from './cart-badge';

export function SiteHeader() {
  return (
    <div className="tophead"><div className="tophead-in">
      <Link href="/" style={{ textDecoration: 'none' }}><span className="brand">Lakky Variety Store</span></Link>
      <span style={{ flex: 1 }} />
      <Link href="/cart" className="btn" style={{ textDecoration: 'none', padding: '9px 14px', minHeight: 0 }}>Cart <CartBadge /></Link>
    </div></div>
  );
}

const tabs = [
  { href: '/', label: 'Home', icon: '🏠', match: (p: string) => p === '/' },
  { href: '/#categories', label: 'Categories', icon: '🗂️', match: (_p: string) => false },
  { href: '/cart', label: 'Cart', icon: '🛒', match: (p: string) => p === '/cart' },
  { href: '/orders', label: 'Orders', icon: '📦', match: (p: string) => p.startsWith('/orders') },
];

export function BottomNav() {
  const path = usePathname();
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
