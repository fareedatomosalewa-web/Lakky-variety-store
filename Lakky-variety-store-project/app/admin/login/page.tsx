'use client';
import { useState } from 'react';
export default function AdminLogin() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const go = () => {
    if (!email || !pw) { alert('Email + password required (single admin V1)'); return; }
    localStorage.setItem('lakky-admin', JSON.stringify({ email }));
    location.href = '/admin';
  };
  return (<div className="card"><h3>Admin login — single owner, Better Auth email+password</h3>
    <input placeholder="owner@lakkyvariety.ng" value={email} onChange={e=>setEmail(e.target.value)} />
    <input type="password" placeholder="password" value={pw} onChange={e=>setPw(e.target.value)} />
    <button className="btn" onClick={go}>Login</button></div>);
}
