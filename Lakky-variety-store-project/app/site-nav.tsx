'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CartBadge from './cart-badge';
import { seedProducts } from '../db/seed';
import { buildTree, normCat, type CatNode } from '../lib/categories';

// Category picking is shared with the home page: the trail is stored and the
// home page listens for CAT_EVENT (works on any page, no reload needed).
export const CAT_EVENT = 'lakky-cat';
export function pickCategory(trail: string[]) {
  try {
    localStorage.setItem('lakky-cat-trail', JSON.stringify((trail || []).map(normCat)));
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(CAT_EVENT));
}
export function readTrail(): string[] {
  try {
    const t = JSON.parse(localStorage.getItem('lakky-cat-trail') || '[]');
    return Array.isArray(t) ? t.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

export function SiteHeader() {
  const path = usePathname();
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    try { setLogged(!!JSON.parse(localStorage.getItem('lakky-customer') || '{}').token); } catch { setLogged(false); }
  }, [path]);
  if (path.startsWith('/admin') || path.startsWith('/staff')) return null;
  return (
    <div className="tophead"><div className="tophead-in">
      <Link href={logged ? '/profile' : '/login'} aria-label={logged ? 'Profile' : 'Log in'} style={{ textDecoration: 'none', fontSize: 20 }}>{logged ? '👤' : '🔑'}</Link>
      <Link href="/" style={{ textDecoration: 'none' }}><span className="brand">Lakky Variety Store</span></Link>
      <span style={{ flex: 1 }} />
      <Link href="/cart" style={{ textDecoration: 'none', background: 'var(--plum)', color: '#fff', borderRadius: 999, padding: '8px 16px', fontWeight: 700 }}>🛒 <CartBadge /></Link>
    </div></div>
  );
}

function CategoriesPopup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState<string[]>([]);
  const tree = buildTree(seedProducts as any[]);
  const go = (trail: string[]) => {
    pickCategory(trail);
    onClose();
    if (path !== '/') router.push('/');
    else document.getElementById('shop')?.scrollIntoView();
  };
  const toggle = (trail: string[]) => {
    const k = trail.join('>');
    setOpen((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };
  const rows = (nodes: CatNode[], trail: string[], depth: number) =>
    nodes.map((n) => {
      const t = [...trail, n.key];
      const k = t.join('>');
      const expanded = open.includes(k);
      return (
        <div key={k}>
          <button
            onClick={() => (n.children.length ? toggle(t) : go(t))}
            style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, borderBottom: '1px solid var(--line)', padding: '12px 8px 12px ' + (8 + depth * 18) + 'px', fontSize: 16, fontWeight: depth === 0 ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}
          >{n.children.length ? (expanded ? '▾ ' : '▸ ') : '• '}{n.name} <span className="small">({n.count})</span></button>
          {expanded && (
            <div>
              <button
                onClick={() => go(t)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: '#FDF6EE', border: 0, borderBottom: '1px solid var(--line)', padding: '12px 8px 12px ' + (8 + (depth + 1) * 18) + 'px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--plum)' }}
              >All {n.name}</button>
              {rows(n.children, t, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(36,33,36,.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 720, maxHeight: '80vh', overflowY: 'auto', margin: '0 0 70px', borderRadius: '20px 20px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center' }}><h2 style={{ margin: 0, flex: 1 }}>Categories</h2><button className="btn-s" onClick={onClose}>Close ✕</button></div>
        {rows(tree, [], 0)}
      </div>
    </div>
  );
}

const tabs = [
  { href: '/', label: 'Home', icon: '🏠', match: (p: string) => p === '/' },
  { href: '/wishlist', label: 'Wishlist', icon: '🤍', match: (p: string) => p.startsWith('/wishlist') },
  { href: '/cart', label: 'Cart', icon: '🛒', match: (p: string) => p === '/cart' },
  { href: '/orders', label: 'Track', icon: '📦', match: (p: string) => p.startsWith('/orders') },
];

export function BottomNav() {
  const path = usePathname();
  const [showCats, setShowCats] = useState(false);
  useEffect(() => {
    const sync = () => setShowCats(window.location.hash === '#categories');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const openCats = () => { window.location.hash = 'categories'; };
  const closeCats = () => {
    if (window.location.hash === '#categories') window.history.back();
    else setShowCats(false);
  };
  if (path.startsWith('/admin') || path.startsWith('/staff')) return null;
  const linkStyle = { textDecoration: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 12px', background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit' } as const;
  return (
    <nav className="bottomnav">
      <Link key="Home" href="/" className={path === '/' ? 'on' : ''}>
        <span style={{ fontSize: 18 }}>🏠</span>Home
      </Link>
      <button key="Categories" onClick={openCats} style={linkStyle} aria-label="Categories">
        <span style={{ fontSize: 18 }}>🗂️</span>Categories
      </button>
      {tabs.slice(1).map((t) => (
        <Link key={t.label} href={t.href} className={t.match(path) ? 'on' : ''}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
        </Link>
      ))}
      {showCats && <CategoriesPopup onClose={closeCats} />}
    </nav>
  );
}
