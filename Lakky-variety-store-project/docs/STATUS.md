# STATUS — what is REAL vs DEMO (v1.13 V1 shop build)
# Updated: 2026-10-06. Rule until owner says otherwise: no real orders, no real bank details, no customer link.

## REAL (Supabase-backed, proven by checks + e2e)
- Settings incl. all numbers + content (bank, fees, tags, hours, banner, social, about/help)
- Checkout (Pickup/Delivery/Stockpile, credit-first, coupons, 1-week pickup rule) → pending_refs
- Pay (REF- codes, copy buttons, receipt upload to private bucket, agreed_at)
- Admin Confirm transaction (orders + items + guarded stock move + overpay auto-credit)
- Accept/reject-reasons/partial + message threads + fee marks + refund approve/decline
- Track (live order + fee math + messages + cancel + overpay choice + received + reviews + problems)
- Customer accounts + staff invites/approvals + role gates + customer password reset + activity log
- Catalogue tools: filters/sort/sold-out-last/tiers/discounts/coupons/wishlist/media/product editor
- Dashboard numbers + CSV exports + reminders/aged/fee sections + nightly JSON backup + RLS 34/34
- PWA shell: manifest + icons + offline cache + push stub (VAPID keys later)

## DEMO / later versions (do NOT rely on)
- Email sending + email OTP (owner resets passwords meanwhile)
- Native APK, Google sign-in, other integrations, VAPID push keys
- Off-machine backup copy (local + Supabase platform only)
- AI suggestions (events collected only)
