'use client';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
export default function AdminLogin() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  const [showPw, setShowPw] = useState(false);
  const go = async () => {
    setErr('');
    if (!email || !pw) { setErr('Email + password required (single admin V1)'); return; }
    const res = await authClient.signIn.email({ email, password: pw });
    if (res.error) { setErr('Login failed — check email + password'); return; }
    location.href = '/admin';
  };
  return (<div className="card"><h3>Admin login — single owner</h3>
    <input placeholder="owner email" value={email} onChange={e=>setEmail(e.target.value)} />
    <div style={{ display: 'flex', gap: 8 }}><input type={showPw ? 'text' : 'password'} placeholder="password" value={pw} onChange={e=>setPw(e.target.value)} style={{ margin: '6px 0' }} /><button className="btn-s" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? '🙈' : '👁️'}</button></div>
    <button className="btn" onClick={go}>Login</button>
    {err && <div><b>{err}</b></div>}</div>);
}
