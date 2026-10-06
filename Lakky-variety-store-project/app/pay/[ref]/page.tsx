'use client';
import { useEffect, useState } from 'react';
import { getSettings, submitReceipt } from '../../../lib/shop-actions';
import { seedSettings } from '../../../db/seed';

function copyText(t: string, done: () => void) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(ta); done();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done).catch(fallback);
  else fallback();
}

function compressImage(file: File): Promise<{ base64: string; ext: string; type: string } | null> {
  return new Promise((resolve) => {
    if (file.size > 5 * 1024 * 1024) { resolve(null); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.8);
      if (dataUrl.length > 6 * 1024 * 1024) { resolve(null); return; }
      resolve({ base64: dataUrl.split(',')[1], ext: 'jpg', type: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export default function PayPage({ params }: { params: { ref: string } }) {
  const [p, setP] = useState<any>({});
  const [s, setS] = useState<any>(seedSettings);
  const [file, setFile] = useState<{ base64: string; ext: string; type: string } | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [box1, setBox1] = useState(false); const [box2, setBox2] = useState(false);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    setP(JSON.parse(localStorage.getItem('lakky-pending') || '{}'));
    getSettings().then((r: any) => { if (r.ok) setS({ ...seedSettings, ...r.settings }); });
    try {
      const raw = JSON.parse(localStorage.getItem('lakky-settings') || 'null');
      if (raw) setS((cur: any) => ({ ...cur, ...raw }));
    } catch { /* seed defaults */ }
  }, []);
  const total = Number(p.total || 0);
  const bank = (s.bankDetails as any) || {};
  const onFile = async (f: File | undefined) => {
    setFileErr('');
    if (!f) { setFile(null); return; }
    const out = await compressImage(f);
    if (!out) { setFile(null); setFileErr('That file is too big. Please use a photo under 5MB.'); return; }
    setFile(out);
  };
  const canSubmit = !sending && box1 && box2 && (total === 0 || file !== null);
  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      const r: any = await submitReceipt({ ref: params.ref, amount: total, fileBase64: file ? file.base64 : null, contentType: file ? file.type : '', ext: file ? file.ext : '' });
      if (!r.ok) { setSending(false); return; }
    } catch { /* fall through to local confirmation */ }
    localStorage.setItem('lakky-last-proof', JSON.stringify({ ...p, amount: total, status: 'Payment Confirmation Pending' }));
    localStorage.removeItem('lakky-cart');
    setDone(true); setSending(false);
  };
  if (done) return (<div className="card"><h3>Thank you! We got it.</h3>
    <div>Your reference: <b>{params.ref}</b> <button className="btn" onClick={() => copyText(params.ref, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
    <div><a href="/orders">Track your order →</a></div></div>);
  return (<div className="card"><h3>Pay {params.ref}</h3>
    <div><b>Amount to pay: ₦{total.toLocaleString()}</b></div>
    <div className="small">Bank: {bank.bank} • Account number: {bank.accountNumber} • Name: {bank.accountName}</div>
    <div>Your reference: <b>{params.ref}</b> <button className="btn" onClick={() => copyText(params.ref, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
    <div className="small">Writing this reference in your bank's remark box is optional, but it helps us find your order fast. If you pay by USSD or your bank has no remark box, that's fine.</div>
    <div className="small">Upload your receipt (photo, up to 5MB)</div>
    <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
    <div className="small">A screenshot of your bank app, your bank's SMS alert, or a clear photo of the receipt all work.</div>
    {fileErr && <div><b>{fileErr}</b></div>}
    <div><label><input type="checkbox" checked={box1} onChange={(e) => setBox1(e.target.checked)} /> I confirm I have transferred ₦{total.toLocaleString()}.</label></div>
    <div><label><input type="checkbox" checked={box2} onChange={(e) => setBox2(e.target.checked)} /> I have read and agree to the rules.</label> <a href="/terms" target="_blank" rel="noreferrer">Read the rules</a></div>
    <div className="small">Short version: we keep your items free for {s.freeHoldDays} days. After that, ₦{Number(s.globalDailyFee).toLocaleString()} per day.</div>
    <button className="btn" disabled={!canSubmit} onClick={submit}>{sending ? 'Sending…' : 'Submit'}</button></div>);
}
