import { getSettings } from '../../lib/shop-actions';
import { seedSettings } from '../../db/seed';

export default async function TermsPage() {
  let s: any = seedSettings;
  try {
    const r: any = await getSettings();
    if (r.ok) s = { ...seedSettings, ...r.settings };
  } catch { /* seed defaults */ }
  const hold = s.freeHoldDays, fee = Number(s.globalDailyFee).toLocaleString(), abandon = s.abandonDays;
  return (<div className="card"><h2>Our rules (plain words)</h2>
    <p>1. Pay the exact amount shown, to the bank account shown. Then upload your receipt.</p>
    <p>2. Your reference. After you order, you get a reference like P-2026-0004. Writing it in your bank's remark box is your choice, but it helps. If there is a problem, we can find your order fast. If you pay by USSD or your bank has no remark box, that's fine. Always keep your receipt.</p>
    <p>3. We confirm your payment when we see the money in our bank. Then you get your Order ID.</p>
    <p>4. We keep your items safe for {hold} days. This is free. Each order is kept apart so nothing gets mixed up.</p>
    <p>5. After {hold} days, a small fee of ₦{fee} per day starts. This pays for the space and care. While your fees are paid up to date, we are responsible for your items. If something is lost, missing or mixed up, we will replace it or give you store credit or a refund.</p>
    <p>6. If you do not pay the fee and we cannot reach you for {abandon} days, we may stop keeping your items. We will try to contact you first. After this, we are not responsible for the items.</p>
    <p>7. Please check your items as soon as you receive them. For pickup, check before you leave. For delivery, check when it arrives. If anything is missing or wrong, tell us within 2 days.</p>
    <p>8. If your item runs out before we confirm your payment, you choose: store credit for your next order, or a refund. A refund goes only to the same bank account you paid from. If you give a different account, we cannot refund you.</p>
  </div>);
}

