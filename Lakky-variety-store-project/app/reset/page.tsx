'use client';
import { useState } from 'react';
import { resetPasswordByContact } from '../../lib/shop-v1';
export default function ResetPage() {
  const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const go = async () => {
    setErr('');
    if (!email.trim() || !phone.trim() || !pw || !pw2) { setErr('Please fill your email, phone and the new password twice.'); return; }
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return; }
    setBusy(true);
    const r: any = await resetPasswordByContact({ email, phone, newPassword: pw }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) {
      setErr(r?.reason === 'no-match' ? 'No account has that email and phone together. Check the phone number you used with the shop, or message the shop on WhatsApp.' : r?.reason === 'missing' ? 'Please fill every box (password 6+ characters).' : 'Could not reset the password. Please try again.');
      return;
    }
    setDone(true);
  };
  if (done) return (<div className="card"><h2 style={{ marginTop: 0 }}>Password changed ✓</h2>
    <div>You can now log in with your email and the new password.</div>
    <a className="btn" href="/login" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 10 }}>Go to log in</a>
  </div>);
  return (<div className="card"><h2 style={{ marginTop: 0 }}>Forgot password</h2>
    <div className="small">Enter the email and the phone number on your account, then choose a new password. Both must match — this protects your account.</div>
    <input placeholder="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
    <input placeholder="Phone on your account" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
    <div style={{ display: 'flex', gap: 8 }}>
      <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="New password (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} style={{ margin: '6px 0' }} />
      <button className="btn-s" onClick={() => setShowPw(!showPw)} aria-label="Show or hide password">{showPw ? '🙈' : '👁️'}</button>
    </div>
    <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Type the new password again" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
    <button className="btn" style={{ width: '100%' }} onClick={go} disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
    {err && <div className="notice-err" style={{ whiteSpace: 'normal', marginTop: 8 }}>⚠️ {err}</div>}
    <div className="small" style={{ marginTop: 10 }}><a href="/login">Back to log in</a> · <a href="/signup">Create an account</a></div>
  </div>);
}
