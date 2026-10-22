'use client';
import { useState } from 'react';
import { signInCustomer } from '../../lib/shop-v1';
const MESSAGES: Record<string, string> = {
  missing: 'Please enter your email and password.',
  'no-account': 'No account uses that email. Check the spelling, or create an account.',
  'no-password': 'This account has no password yet (it was created in the shop). Use “Forgot password” with the email and phone on your account.',
  'wrong-password': 'That password is not correct. Try again, or use “Forgot password”.',
  error: 'We could not log you in just now. Please try again.',
};
export default function LoginPage() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setErr('');
    if (!email.trim() || !pw) { setErr(MESSAGES.missing); return; }
    setBusy(true);
    const r: any = await signInCustomer({ email, password: pw }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setErr(MESSAGES[r?.reason] || MESSAGES.error); return; }
    const c = JSON.parse(localStorage.getItem('lakky-customer') || '{}');
    localStorage.setItem('lakky-customer', JSON.stringify({ ...c, id: r.customerId, name: r.name, email: String(email).trim().toLowerCase(), token: r.token }));
    location.href = '/orders';
  };
  return (<div className="card"><h2 style={{ marginTop: 0 }}>Log in</h2>
    <input placeholder="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
    <div style={{ display: 'flex', gap: 8 }}>
      <input type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} style={{ margin: '6px 0' }} />
      <button className="btn-s" onClick={() => setShowPw(!showPw)} aria-label="Show or hide password">{showPw ? '🙈' : '👁️'}</button>
    </div>
    <button className="btn" style={{ width: '100%' }} onClick={go} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
    {err && <div className="notice-err" style={{ whiteSpace: 'normal', marginTop: 8 }}>⚠️ {err}</div>}
    <div className="small" style={{ marginTop: 10 }}><a href="/reset">Forgot password?</a></div>
    <div className="small" style={{ marginTop: 6 }}>New here? <a href="/signup">Create an account</a>.</div>
    <div className="small">Old account from the shop? If you never set a password, use <a href="/reset">Forgot password</a> with the same email and phone number we have for you.</div>
  </div>);
}
