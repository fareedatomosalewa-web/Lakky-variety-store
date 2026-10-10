'use client';
import { useState } from 'react';
import { seedProducts } from '../../../db/seed';
import { useAdminGuard } from '../../../lib/use-admin-guard';
import { addAddon, addMedia, createCoupon, getProductAdmin, listCoupons, saveProductAdmin } from '../../../lib/shop-v1';
export default function AdminProducts() {
  const allowed = useAdminGuard();
  const [name, setName] = useState((seedProducts as any[])[0].name);
  const [p, setP] = useState<any>(null);
  const [vars, setVars] = useState<any[]>([]);
  const [tiers, setTiers] = useState('');
  const [disc, setDisc] = useState<any>({ type: '', value: '', start: '', end: '' });
  const [thresh, setThresh] = useState('');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [cp, setCp] = useState({ code: '', percent: '', expiry: '', limit: '10' });
  const [addon, setAddon] = useState({ name: '', price: '', stock: '' });
  const [msg, setMsg] = useState('');
  if (!allowed) return <div className="card">Checking admin session…</div>;
  const load = async (n: string) => {
    setName(n);
    const r: any = await getProductAdmin({ name: n }).catch(() => null);
    if (r && r.ok) {
      setP(r.product); setVars(r.variants);
      try { setTiers(r.product.wholesale_tiers ? JSON.stringify(typeof r.product.wholesale_tiers === 'string' ? JSON.parse(r.product.wholesale_tiers) : r.product.wholesale_tiers) : ''); } catch { setTiers(''); }
      setDisc({ type: r.product.discount_type || '', value: r.product.discount_value ?? '', start: r.product.discount_start ? String(r.product.discount_start).slice(0, 10) : '', end: r.product.discount_end ? String(r.product.discount_end).slice(0, 10) : '' });
      setThresh(r.product.low_stock_threshold ?? '');
    } else { setP(null); setMsg('Not in Supabase yet — sync the catalogue first.'); }
  };
  const save = async () => {
    let wt: any = null;
    try { wt = tiers.trim() ? JSON.parse(tiers) : null; } catch { setMsg('Tier table is not valid JSON. Example: [{"min":5,"max":11,"each":450}]'); return; }
    const r: any = await saveProductAdmin({
      name,
      patch: {
        low_stock_threshold: thresh === '' ? null : Number(thresh),
        wholesale_tiers: wt,
        discount_type: disc.type || null, discount_value: disc.value === '' ? null : Number(disc.value),
        discount_start: disc.start || null, discount_end: disc.end || null,
      },
      variants: vars.map((v: any) => ({ id: v.id, price: Number(v.price), available: Number(v.available), active: v.active !== false })),
    }).catch(() => null);
    setMsg(r && r.ok ? 'Saved.' : 'Save failed.');
  };
  const restock = async () => {
    const r: any = await saveProductAdmin({ name, patch: { markRestocked: true } }).catch(() => null);
    setMsg(r && r.ok ? 'Marked restocked (tag shows for your set days).' : 'Failed.');
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { setMsg('Too big — 20MB max.'); return; }
    const buf: ArrayBuffer = await f.arrayBuffer();
    let b64 = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) b64 += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
    const r: any = await addMedia({ productName: name, fileBase64: btoa(b64), contentType: f.type || 'image/jpeg', ext, kind: 'media' }).catch(() => null);
    setMsg(r && r.ok ? 'Photo/video added (max 4 per product).' : 'Upload failed.');
  };
  const addAd = async () => {
    const r: any = await addAddon({ productName: name, name: addon.name, price: Number(addon.price), stock: Number(addon.stock) }).catch(() => null);
    setMsg(r && r.ok ? 'Add-on added.' : 'Failed.'); setAddon({ name: '', price: '', stock: '' });
  };
  const loadCoupons = async () => { const r: any = await listCoupons().catch(() => null); if (r && r.ok) setCoupons(r.rows); };
  const mkCoupon = async () => {
    const r: any = await createCoupon({ code: cp.code, percent: Number(cp.percent), expiry: cp.expiry || undefined, limit: Number(cp.limit) }).catch(() => null);
    setMsg(r && r.ok ? 'Coupon saved (needs percent, expiry, limit — always).' : 'Failed — code, percent, expiry and limit are all needed.');
    setCp({ code: '', percent: '', expiry: '', limit: '10' }); loadCoupons();
  };
  return (<div><h2>Products — owner edits without code</h2>
    <div className="card"><select value={name} onChange={(e) => load(e.target.value)}>{(seedProducts as any[]).map((x: any) => <option key={x.name} value={x.name}>{x.name}</option>)}</select> <button className="btn-s" onClick={() => load(name)}>Open</button></div>
    {p && (<div className="card"><h3>{p.name}</h3>
      <div className="small">Low-stock alert number (customers see “Few pieces left” at/below it; empty = silent)</div>
      <input type="number" placeholder="e.g. 3 (empty = silent)" value={thresh} onChange={(e) => setThresh(e.target.value)} />
      {vars.map((v: any, i: number) => <div key={v.id} className="small">{Object.values(v.attrs).join(' / ')} — ₦<input type="number" value={v.price} onChange={(e) => { const c = [...vars]; c[i].price = e.target.value; setVars(c); }} style={{ width: 90 }} /> — stock <input type="number" value={v.available} onChange={(e) => { const c = [...vars]; c[i].available = e.target.value; setVars(c); }} style={{ width: 70 }} /></div>)}
      <div className="small">Wholesale tiers JSON (e.g. [{`{"min":5,"max":11,"each":450}`}, empty = none)</div>
      <textarea value={tiers} onChange={(e) => setTiers(e.target.value)} />
      <div className="small">Discount</div>
      <select value={disc.type} onChange={(e) => setDisc({ ...disc, type: e.target.value })}><option value="">No discount</option><option value="percent">Percent % off</option><option value="amount">₦ off</option></select>
      <input type="number" placeholder="Value" value={disc.value} onChange={(e) => setDisc({ ...disc, value: e.target.value })} />
      <input type="date" value={disc.start} onChange={(e) => setDisc({ ...disc, start: e.target.value })} />
      <input type="date" value={disc.end} onChange={(e) => setDisc({ ...disc, end: e.target.value })} />
      <div><button className="btn" onClick={save}>Save product</button> <button className="btn-s" onClick={restock}>Mark restocked</button></div>
      <div className="small">Photos (max 4 total, video ≤60s, ≤20MB, no downloads for viewers)</div>
      <input type="file" accept="image/*,video/mp4,video/webm" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="small">Add-on for this product (own price + stock)</div>
      <input placeholder="Name" value={addon.name} onChange={(e) => setAddon({ ...addon, name: e.target.value })} />
      <input type="number" placeholder="Price ₦" value={addon.price} onChange={(e) => setAddon({ ...addon, price: e.target.value })} />
      <input type="number" placeholder="Stock count" value={addon.stock} onChange={(e) => setAddon({ ...addon, stock: e.target.value })} />
      <button className="btn-s" onClick={addAd}>Add add-on</button>
      <div><b>{msg}</b></div></div>)}
    <div className="card"><h3>Coupon codes</h3><button className="btn-s" onClick={loadCoupons}>Show coupons</button>
      {coupons.map((c: any) => <div key={c.code} className="small">{c.code} — {c.percent}% — till {String(c.expiry).slice(0, 10)} — used {c.used}/{c.usage_limit}</div>)}
      <input placeholder="CODE" value={cp.code} onChange={(e) => setCp({ ...cp, code: e.target.value })} />
      <input type="number" placeholder="% off" value={cp.percent} onChange={(e) => setCp({ ...cp, percent: e.target.value })} />
      <input type="date" value={cp.expiry} onChange={(e) => setCp({ ...cp, expiry: e.target.value })} />
      <input type="number" placeholder="Usage limit" value={cp.limit} onChange={(e) => setCp({ ...cp, limit: e.target.value })} />
      <button className="btn-s" onClick={mkCoupon}>Create coupon</button></div>
  </div>);
}
