'use client';
// Dedicated ADMIN sign-in. Its own address: /admin/login
// Completely separate from the customer login (/login), which only knows
// customer accounts and can never accept the owner's admin email.
import { useEffect, useState } from 'react';
import { authClient } from '../../../lib/auth-client';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // If the owner is already signed in, skip straight to the console.
  useEffect(() => {
    authClient.getSession().then((s: any) => {
      if (s?.data?.user && (s.data.user as any).role === 'admin') location.replace('/admin');
    }).catch(() => {});
  }, []);

  const go = async () => {
    setErr('');
    if (!email.trim() || !pw) { setErr('Enter the admin email and the admin password.'); return; }
    setBusy(true);
    try {
      const res: any = await authClient.signIn.email({ email: email.trim(), password: pw });
      setBusy(false);
      if (res?.error) {
        // Better Auth deliberately gives one message for wrong email AND wrong
        // password, so we never say which one is wrong.
        setErr('That admin email and password did not match. Use the password you set for the admin account (it is separate from any customer password).');
        return;
      }
      location.href = '/admin';
    } catch {
      setBusy(false);
      setErr('Could not reach the server. Check your connection and try again.');
    }
  };

  return (
    <div className="card" style={{ maxWidth: 460, margin: '40px auto' }}>
      <div style={{ display: 'inline-block', background: 'var(--plum)', color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>ADMIN</div>
      <h2 style={{ marginTop: 10, marginBottom: 4 }}>Admin sign-in</h2>
      <div className="small" style={{ marginBottom: 10 }}>Owner only. This is not the customer login — customer accounts cannot open the admin area.</div>
      <input placeholder="Admin email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} style={{ margin: '6px 0' }} />
        <button className="btn-s" type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? '🙈' : '👁️'}</button>
      </div>
      <button className="btn" style={{ width: '100%' }} onClick={go} disabled={busy}>{busy ? 'Signing in…' : 'Sign in as admin'}</button>
      {err && <div className="notice-err" style={{ whiteSpace: 'normal', marginTop: 8 }}>⚠️ {err}</div>}
      <div className="small" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eee' }}>
        This page: <b>/admin/login</b> — save it as a bookmark.
      </div>
      <div className="small" style={{ marginTop: 6 }}>
        Not the owner? <a href="/login">Customer log in</a> · <a href="/">Back to shop</a>
      </div>
    </div>
  );
}
