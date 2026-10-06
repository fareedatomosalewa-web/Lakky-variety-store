'use client';

import { useEffect, useState } from 'react';

function countCart(): number {
  try {
    const cart: any[] = JSON.parse(localStorage.getItem('lakky-cart') || '[]');
    return cart.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  } catch { return 0; }
}

export default function CartBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(countCart());
    const upd = () => setN(countCart());
    window.addEventListener('lakky-cart-updated', upd);
    window.addEventListener('storage', upd);
    return () => {
      window.removeEventListener('lakky-cart-updated', upd);
      window.removeEventListener('storage', upd);
    };
  }, []);
  if (!n) return null;
  return <span className="badge">{n}</span>;
}
