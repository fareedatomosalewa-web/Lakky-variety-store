'use client';
import { useEffect, useState } from 'react';
import { getSettings, submitReceipt } from '../../../lib/shop-actions';
import Steps from '../../checkout/steps';
import { useCustomerOnly } from '../../../lib/use-customer-only';
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
  useCustomerOnly();
  const [p, setP] = useState<any>({});
  const [s, setS] = useState<any>(seedSettings);
  const [file, setFile] = useState<{ base64: string; ext: string; type: string } | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [box1, setBox1] = useState(false); const [box2, setBox2] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedAcct, setCopiedAcct] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const orderId = decodeURIComponent(params.ref);
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
    if (!f) return;
    const out = await compressImage(f);
    if (!out) { setFile(null); setFileErr('That file is too big. Please use a photo under 5MB.'); return; }
    setFile(out);
  };
  const canSubmit = !sending && box1 && box2 && (total === 0 || file !== null);
  const submit = async () => {
    if (!canSubmit) return;
    setSending(true); setSendErr('');
    try {
      const r: any = await submitReceipt({ ref: params.ref, amount: total, fileBase64: file ? file.base64 : null, contentType: file ? file.type : '', ext: file ? file.ext : '' });
      if (!r.ok) { setSending(false); setSendErr(r.reason === 'receipt-required' ? 'Please upload your receipt photo first.' : 'Could not save. Check your connection and tap Submit again — nothing was sent.'); return; }
    } catch { setSending(false); setSendErr('Could not save. Check your connection and tap Submit again — nothing was sent.'); return; }
    localStorage.setItem('lakky-last-proof', JSON.stringify({ ...p, amount: total, status: 'Payment Confirmation Pending' }));
    localStorage.removeItem('lakky-cart');
    setDone(true); setSending(false);
  };
  if (done) return (<div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><a href="/checkout" style={{ textDecoration: 'none', fontSize: 20 }}>←</a><h2 style={{ margin: 0 }}>Done</h2></div>
    <div className="card" style={{ textAlign: 'center' }}><h2>Thank you! We got it.</h2>
    <div>Your Order ID: <b>{orderId}</b> <button className="btn-s" onClick={() => copyText(orderId, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
    <div className="small" style={{ marginTop: 8 }}>Use this Order ID + your phone number to track your order.</div>
    <div style={{ marginTop: 8 }}><a className="btn" href="/orders" style={{ textDecoration: 'none' }}>Track your order →</a></div></div></div>);
  return (<div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><a href="/checkout" style={{ textDecoration: 'none', fontSize: 20 }}>←</a><h2 style={{ margin: 0 }}>Pay</h2><span style={{ flex: 1 }} /><span className="badge badge-mut">{orderId}</span></div>
    <Steps step={3} />
    <div className="card" style={{ textAlign: 'center' }}><div className="small" style={{ fontWeight: 700 }}>YOUR ORDER ID</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--plum)', overflowWrap: 'anywhere' }}>{orderId}</div>
      <button className="btn-s" onClick={() => copyText(orderId, () => { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); })}>{copiedId ? 'Copied ✓' : 'Copy Order ID'}</button></div>
    <div className="card" style={{ textAlign: 'center' }}><div className="small" style={{ fontWeight: 700 }}>TRANSFER EXACTLY</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--plum)' }}>₦{total.toLocaleString()}</div>
      <button className="btn-s" onClick={() => copyText(String(total), () => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? 'Copied ✓' : 'Copy amount'}</button></div>
    <div className="card"><div className="small" style={{ fontWeight: 700 }}>TO THIS ACCOUNT</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>Bank</span><b>{bank.bank}</b></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed var(--line)' }}><span>Account no.</span><span><b>{bank.accountNumber}</b> <button className="btn-s" onClick={() => copyText(String(bank.accountNumber || ''), () => { setCopiedAcct(true); setTimeout(() => setCopiedAcct(false), 2000); })}>{copiedAcct ? 'Copied ✓' : 'Copy'}</button></span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed var(--line)' }}><span>Name</span><b>{bank.accountName}</b></div></div>
    <div className="card"><div className="small" style={{ fontWeight: 700 }}>BANK REMARK — NOTHING TO WRITE</div>
      <div className="small">Leave your bank's remark box empty. We match your payment by the amount, your name and your receipt.</div></div>
    <label htmlFor="receipt-file"><div className="dropzone"><div style={{ fontSize: 28 }}>🧾</div><b>Upload your receipt</b><div className="small">Screenshot, SMS alert or photo • up to 5MB</div></div></label>
    <input id="receipt-file" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
    {file && file.base64 && (<div className="card" style={{ textAlign: 'center' }}><div className="small" style={{ fontWeight: 700 }}>YOUR RECEIPT — TAP TO CHANGE IT</div>
      <label htmlFor="receipt-file" style={{ cursor: 'pointer', display: 'block' }}><img src={`data:${file.type || 'image/jpeg'};base64,${file.base64}`} alt="Your receipt preview" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--line)' }} /></label>
      <div className="small">Not the right one? Tap the photo to pick another.</div></div>)}
    {file && !file.base64 && <div className="small">Photo ready ✓ (tap the box to change it)</div>}
    {fileErr && <div><b>{fileErr}</b></div>}
    <div><label><input type="checkbox" checked={box1} onChange={(e) => setBox1(e.target.checked)} /> I confirm I have transferred ₦{total.toLocaleString()}.</label></div>
    <div><label><input type="checkbox" checked={box2} onChange={(e) => setBox2(e.target.checked)} /> I agree to the <a href="/terms" target="_blank" rel="noreferrer">store rules</a>{(p.method || p.fulfilment) === 'Stockpile' ? ` (free ${s.freeHoldDays}-day hold, then ₦${Number(s.stockpileFeePerDay ?? s.globalDailyFee).toLocaleString()}/day).` : '.'}</label></div>
    <button className="btn" style={{ width: '100%' }} disabled={!canSubmit} onClick={submit}>{sending ? 'Sending…' : 'Submit receipt'}</button>
    {sendErr && <div><b>{sendErr}</b></div>}</div>);
}
