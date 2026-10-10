'use client';
import { useState } from 'react';
import { signInCustomer } from '../../lib/shop-v1';
export default function LoginPage() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false); const [err, setErr] = useState('');
  const go = async () => {
    setErr('');
    const r: any = await signInCustomer({ email, password: pw }).catch(() => null);
    if (!r || !r.ok) { setErr('Login failed — check email + password, or ask the shop to reset it.'); return; }
    const c = JSON.parse(localStorage.getItem('lakky-customer') || '{}');
    localStorage.setItem('lakky-customer', JSON.stringify({ ...c, id: r.customerId, name: r.name, email, token: r.token }));
    location.href = '/orders';
  };
  return (<div className="card"><h2>Log in</h2>
    <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
    <div style={{ display: 'flex', gap: 8 }}><input type={showPw ? 'text' : 'password'} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ margin: '6px 0' }} /><button className="btn-s" onClick={() => setShowPw(!showPw)} aria-label="Show or hide password">{showPw ? '🙈' : '👁️'}</button></div>
    <button className="btn" onClick={go}>Log in</button>
    {err && <div><b>{err}</b></div>}
    <div className="small">New here? <a href="/signup">Create an account</a>.</div></div>);
}
