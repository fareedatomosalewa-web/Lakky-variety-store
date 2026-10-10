import { getSettings } from '../../lib/shop-actions';
import { seedSettings } from '../../db/seed';
export default async function AboutPage() {
  let s: any = seedSettings;
  try { const r: any = await getSettings(); if (r.ok) s = { ...seedSettings, ...r.settings }; } catch { /* defaults */ }
  return (<div><div className="card"><h2>About the shop</h2><div>{s.aboutText || 'Lakky Variety Store — something for every day.'}</div></div>
    <div className="card"><h2>Help / Contact</h2><div>{s.helpText || 'Message us on WhatsApp and we will help you.'}</div>{s.shopHours ? <div className="small">Open: {s.shopHours}</div> : null}<div><a href="/notifications/prefs">Notification settings →</a> • <a href="/wishlist">Saved items →</a></div></div></div>);
}
