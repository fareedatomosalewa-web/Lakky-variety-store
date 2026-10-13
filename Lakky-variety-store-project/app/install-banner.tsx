'use client';

import { useEffect, useState } from 'react';

// Shows an install card only to visitors who have NOT installed yet:
// hidden when running as the installed app, after install, or once dismissed.
export default function InstallBanner() {
  const [evt, setEvt] = useState<any>(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (installed) return;
    try {
      if (localStorage.getItem('lakky-install-hide') === '1') return;
    } catch { /* show anyway */ }
    const onPrompt = (e: any) => { e.preventDefault(); setEvt(e); };
    const onDone = () => setOut(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onDone);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onDone);
    };
  }, []);
  if (out || !evt) return null;
  const hide = () => {
    try { localStorage.setItem('lakky-install-hide', '1'); } catch { /* ignore */ }
    setOut(true);
  };
  const go = async () => {
    try { await evt.prompt(); await evt.userChoice; } catch { /* ignore */ }
    hide();
  };
  return (
    <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ flex: 1 }}><b>Install Lakky Variety Store</b><div className="small">Faster opening, works offline.</div></div>
      <button className="btn" style={{ minHeight: 0, padding: '9px 14px' }} onClick={go}>Install</button>
      <button className="btn-s" style={{ minHeight: 0, padding: '9px 12px' }} onClick={hide}>Later</button>
    </div>
  );
}
