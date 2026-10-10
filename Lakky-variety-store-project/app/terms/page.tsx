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
    <h3>Order ID and Reference ID</h3>
    <p>Your Order ID (like LVS-009-9270) is the name of your order in this app. Use it to find and track your order. Your Reference ID (like REF-K7Q2M9) is shown beside our account number. Write it in your bank remark box so we can match your payment fast, even if your receipt is blurry.</p>
    <h3>Underpayment and overpayment</h3>
    <p>If you pay less than the amount shown, your order waits until you pay the rest. If you pay more, we process your order and tell you the extra amount. You choose: keep it as store credit or get a refund.</p>
    <h3>Pay only to the account on your screen</h3>
    <p>Our bank details can change. Always pay to the account shown on your payment screen. Do not use a saved beneficiary.</p>
    <h3>Pickup and delivery</h3>
    <p>Pickup must happen within 1 week. For longer waits, choose Stockpile. Delivery fee is calculated separately and differs by location. You will be contacted for the delivery fee. Our pickup address is shared privately, never in the app.</p>
    <h3>Store credit</h3>
    <p>Store credit never expires. At checkout, all of your credit is used first and you pay only what is left. If your credit covers the whole order, you pay ₦0 and skip the receipt. You can turn credit into cash once it reaches the minimum in Settings.</p>
    <h3>Saved items</h3>
    <p>Hearts only save items to a list. They do not keep stock for you — an item can sell out.</p>
    <h3>Notifications</h3>
    <p>You can turn off any notice type in settings. Missed updates from turned-off notices are your responsibility. Your order status is always visible inside the app.</p>
    <h3>Problems and returns</h3>
    <p>Found something wrong? Report it within 48 hours of receiving your items, with a photo if you can. We review every report. Partially accepted orders are handled message by message inside your order.</p>
    <h3>Privacy</h3>
    <p>We keep your name, phone, email, orders, and what you view and search, so the shop works and gets better. We never sell your information.</p>
  </div>);
}

