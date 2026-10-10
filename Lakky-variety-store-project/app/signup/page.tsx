'use client';
import { useState } from 'react';
import { signUpCustomer } from '../../lib/shop-v1';
export default function SignUpPage() {
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [t1, setT1] = useState(false); const [t2, setT2] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setErr('');
    if (!name || !phone || !email || !pw) { setErr('Please fill name, phone, email and password.'); return; }
    if (!t1 || !t2) { setErr('Please tick both boxes to continue.'); return; }
    const r: any = await signUpCustomer({ name, phone, email, password: pw }).catch(() => null);
    if (!r || !r.ok) { setErr(r && r.reason === 'email-used' ? 'That email is already used. Try logging in.' : 'Could not create the account. Try again.'); return; }
    localStorage.setItem('lakky-customer', JSON.stringify({ id: r.customerId, name, phone, email, token: r.token }));
    location.href = '/';
  };
  return (<div className="card"><h2>Create your account</h2>
    <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
    <input placeholder="Phone, like +234..." value={phone} onChange={(e) => setPhone(e.target.value)} />
    <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
    <div style={{ display: 'flex', gap: 8 }}><input type={showPw ? 'text' : 'password'} placeholder="Password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} style={{ margin: '6px 0' }} /><button className="btn-s" onClick={() => setShowPw(!showPw)} aria-label="Show or hide password">{showPw ? '🙈' : '👁️'}</button></div>
    <div><label><input type="checkbox" style={{ width: 'auto' }} checked={t1} onChange={(e) => setT1(e.target.checked)} /> I agree to the Terms and Conditions.</label> <a href="/terms" target="_blank" rel="noreferrer">Read them</a></div>
    <div><label><input type="checkbox" style={{ width: 'auto' }} checked={t2} onChange={(e) => setT2(e.target.checked)} /> I agree to the Privacy Policy below.</label></div>
    <div className="small">We keep your name, phone, email, orders and what you view so the shop works and gets better. We never sell your info. Full text in Terms.</div>
    <button className="btn" onClick={go}>Sign up</button>
    {err && <div><b>{err}</b></div>}
    <div className="small">Have an account? <a href="/login">Log in</a>. Forgot password? Ask the shop to reset it for you.</div></div>);
}
