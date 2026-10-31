'use client';
import { useState } from 'react';
import { signUpCustomer } from '../../lib/shop-v1';
import { customerPushReady } from '../../lib/customer-push';
import { pushSupported, permissionState, subscribeThisDevice } from '../../lib/customer-push-client';
export default function SignUpPage() {
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [t1, setT1] = useState(false); const [t2, setT2] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [askPush, setAskPush] = useState(false);
  const [pushToken, setPushToken] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
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
          : r?.reason === 'admin-email' ? 'That email is reserved for the shop owner and cannot be used for a customer account. Please use a different email.'
            : r?.reason === 'phone-used' ? 'That phone number already has an account. Log in with your email, or use Forgot password.'
            : r?.reason === 'bad-email' ? 'That email does not look right. Check it and try again.'
              : r?.reason === 'bad-phone' ? 'Please enter a full phone number, like +2348012345678.'
                : r?.reason === 'missing' ? 'Please fill name, phone, email and a password of 6+ characters.'
                  : 'Could not create the account. Please try again.',
      );
      return;
    }
    localStorage.setItem('lakky-customer', JSON.stringify({ id: r.customerId, name, phone, email: String(email).trim().toLowerCase(), token: r.token }));
    const token = String(r.token || '');
    // Check right now (not earlier) so a fast signup still gets the prompt.
    const ready: any = await customerPushReady().catch(() => null);
    const canAsk = Boolean(ready && ready.ready) && pushSupported() && permissionState() !== 'granted' && permissionState() !== 'denied';
    if (canAsk) { setPushToken(token); setAskPush(true); return; }
    if (ready && ready.ready && pushSupported() && permissionState() === 'granted') {
      subscribeThisDevice(token).catch(() => null);
    }
    location.href = '/';
  };

  const allowPush = async () => {
    setPushBusy(true);
    await subscribeThisDevice(pushToken).catch(() => null);
    setPushBusy(false);
    location.href = '/';
  };
  const skipPush = () => {
    try { localStorage.setItem('lakky-push-ask', 'later'); } catch { /* ignore */ }
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
    <div className="small" style={{ marginTop: 10 }}>Have an account? <a href="/login">Log in</a>. Forgot password? <a href="/forgot">Reset it here</a>.</div>
    {askPush && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(36,33,36,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div className="card" role="dialog" aria-modal="true" aria-labelledby="push-title" style={{ maxWidth: 420, margin: 0, boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
        <h2 id="push-title" style={{ marginTop: 0, fontSize: 20 }}>Allow this app to send you notifications?</h2>
        <div className="small" style={{ fontSize: 14, color: 'var(--ink)' }}>
          We will tell you when your order is confirmed, packed, on the way or ready for pickup.
          You can turn it off any time in <b>Notification settings</b>. Everything still works if you say no.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn" style={{ flex: '1 1 160px' }} onClick={allowPush} disabled={pushBusy}>{pushBusy ? 'Switching on…' : 'Allow'}</button>
          <button className="btn-s" style={{ flex: '1 1 120px' }} onClick={skipPush} disabled={pushBusy}>Not now</button>
        </div>
      </div>
    </div>)}
  </div>);
}
