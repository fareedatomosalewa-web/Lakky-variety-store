'use client';
import { useEffect, useState } from 'react';
import { requestResetCode, resetWithCode } from '../../lib/customer-reset';

const ERR: Record<string, string> = {
  'bad-email': 'Please type a valid email address.',
  'mail-not-configured': 'Email sending is not switched on yet. Please message the shop and we will help you.',
  'too-many': 'Too many codes requested. Please wait one hour and try again.',
  wait: 'A code was just sent. Please wait a minute before asking for another.',
  'bad-code': 'That code is not correct. Check the 6 digits and try again.',
  expired: 'That code has expired. Please ask for a new one.',
  'too-many-tries': 'Too many wrong tries. Please ask for a new code.',
  'weak-password': 'Choose a password with at least 6 characters.',
  error: 'Something went wrong. Please try again.',
  'send-failed': 'We could not send the email just now. Please try again in a minute.',
};

export default function ForgotPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setErr(''); setInfo('');
    if (!email.trim()) { setErr(ERR['bad-email']); return; }
    setBusy(true);
    const r: any = await requestResetCode({ email }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setErr(ERR[r?.reason] || ERR.error); return; }
    setStep(2); setInfo('If an account uses that email, a 6-digit code is on its way. It expires in 10 minutes.');
    setCooldown(60);
  };

  const submit = async () => {
    setErr('');
    if (code.replace(/\D/g, '').length !== 6) { setErr('Please type the 6-digit code from the email.'); return; }
    if (pw.length < 6) { setErr(ERR['weak-password']); return; }
    if (pw !== pw2) { setErr('The two passwords do not match.'); return; }
    setBusy(true);
    const r: any = await resetWithCode({ email, code, newPassword: pw }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setErr(ERR[r?.reason] || ERR.error); return; }
    setDone(true);
  };

  if (done) return (<div className="card">
    <h2 style={{ marginTop: 0 }}>Password changed ✓</h2>
    <div>You can now log in with your email and your new password.</div>
    <a className="btn" href="/login" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 10 }}>Go to log in</a>
  </div>);

  return (<div className="card">
    <h2 style={{ marginTop: 0 }}>Forgot password</h2>
    {step === 1 && (<>
      <div className="small">Type the email on your account. We will send you a 6-digit code.</div>
      <input placeholder="Email" type="email" autoComplete="email" value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') sendCode(); }} />
      <button className="btn" style={{ width: '100%' }} onClick={sendCode} disabled={busy}>{busy ? 'Sending…' : 'Send me a code'}</button>
    </>)}

    {step === 2 && (<>
      <div className="small">{info}</div>
      <input placeholder="6-digit code" inputMode="numeric" maxLength={6} value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="New password (6+ characters)" value={pw}
          onChange={(e) => setPw(e.target.value)} style={{ margin: '6px 0' }} />
        <button className="btn-s" onClick={() => setShowPw(!showPw)} aria-label="Show or hide password">{showPw ? 'Hide' : 'Show'}</button>
      </div>
      <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Type the new password again" value={pw2}
        onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      <button className="btn" style={{ width: '100%' }} onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
      <div className="small" style={{ marginTop: 8 }}>
        Wrong email? <a href="/forgot" onClick={(e) => { e.preventDefault(); setStep(1); setInfo(''); setErr(''); }}>Start again</a>
        {' · '}
        {cooldown > 0 ? `Send a new code in ${cooldown}s` : <a href="/forgot" onClick={(e) => { e.preventDefault(); sendCode(); }}>Send a new code</a>}
      </div>
    </>)}

    {err && <div className="notice-err" style={{ whiteSpace: 'normal', marginTop: 8 }}>⚠ {err}</div>}
    <div className="small" style={{ marginTop: 10 }}>
      <a href="/login">Back to log in</a> · <a href="/reset">No email on your account? Use email + phone instead</a>
    </div>
  </div>);
}
