'use client';
import { useState } from 'react';
import { signUpCustomer } from '../../lib/shop-v1';
export default function SignUpPage() {
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [t1, setT1] = useState(false); const [t2, setT2] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setErr('');
    if (!name.trim() || !phone.trim() || !email.trim() || !pw) { setErr('Please fill name, phone, email and password.'); return; }
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (!t1 || !t2) { setErr('Please tick both boxes to continue.'); return; }
    setBusy(true);
    const r: any = await signUpCustomer({ name, phone, email, password: pw }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) {
      setErr(
        r?.reason === 'email-used' ? 'That email already has an account. Log in instead, or use Forgot password.'
          : r?.reason === 'phone-used' ? 'That phone number already has an account. Log in with your email, or use Forgot password.'
            : r?.reason === 'bad-email' ? 'That email does not look right. Check it and try again.'
              : r?.reason === 'bad-phone' ? 'Please enter a full phone number, like +2348012345678.'
                : r?.reason === 'missing' ? 'Please fill name, phone, email and a password of 6+ characters.'
                  : 'Could not create the account. Please try again.',
      );
      return;
    }
    localStorage.setItem('lakky-customer', JSON.stringify({ id: r.customerId, name, phone, email: String(email).trim().toLowerCase(), token: r.token }));
    location.href = '/';
  };
  return (<div className="card"><h2 style={{ marginTop: 0 }}>Create your account</h2>
    <input placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
    <input placeholder="Phone, like +2348012345678" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
    <input placeholder="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
    <div style={{ display: 'flex', gap: 8 }}>
      <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} style={{ margin: '6px 0' }} />
      <button className="btn-s" onClick={() => setShowPw(!showPw)} aria-label="Show or hide password">{showPw ? '🙈' : '👁️'}</button>
    </div>
    <div><label><input type="checkbox" style={{ width: 'auto' }} checked={t1} onChange={(e) => setT1(e.target.checked)} /> I agree to the Terms and Conditions.</label> <a href="/terms" target="_blank" rel="noreferrer">Read them</a></div>
    <div><label><input type="checkbox" style={{ width: 'auto' }} checked={t2} onChange={(e) => setT2(e.target.checked)} /> I agree to the Privacy Policy below.</label></div>
    <div className="small">We keep your name, phone, email, orders and what you view so the shop works and gets better. We never sell your info. Full text in Terms.</div>
    <button className="btn" style={{ width: '100%' }} onClick={go} disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
    {err && <div className="notice-err" style={{ whiteSpace: 'normal', marginTop: 8 }}>⚠️ {err}</div>}
    <div className="small" style={{ marginTop: 10 }}>Have an account? <a href="/login">Log in</a>. Forgot password? <a href="/reset">Reset it here</a>.</div>
  </div>);
}
