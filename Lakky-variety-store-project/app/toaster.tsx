'use client';
import { useEffect, useState } from 'react';

let seq = 0;
export default function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const text = String((e as CustomEvent).detail || '');
      if (!text) return;
      const id = ++seq;
      setItems((s) => [...s.slice(-2), { id, text }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 6000);
    };
    window.addEventListener('lakky-toast', on);
    return () => window.removeEventListener('lakky-toast', on);
  }, []);
  if (!items.length) return null;
  return (
    <div className="toasthost" role="status" aria-live="polite">
      {items.map((i) => <div className="toast" key={i.id}>{i.text}</div>)}
    </div>
  );
}
