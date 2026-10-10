# PRD v1.13 — V1 shop build (sections 1–8): orders, fulfilment, catalogue, accounts, pages
# Version: 1.13 | Date: 2026-10-06 | Base: v1.12
# Owner answers override V1 PRD on conflicts (accounts now, cash-out allowed, all-credit-first,
# owner never shops, P-refs internal only). Unchanged files keep prior rules.
# v1.0–v1.12 never overwritten. No push yet.

## Done
- §1 fixes: threshold stock tags (per-product, silent default), search icon+Enter, password eye
  (admin + sign-up/login), single-variant hides picker, typeable quantities.
- §2 fulfilment: Pickup (1-week rule)/Delivery (fee note + mark-paid)/Stockpile at checkout;
  stockpile fee section in admin, aged-past-max list + release-to-stock, pickup location hidden
  with reveal switch, all numbers/content in Settings.
- §3 checkout/pay: bank copy button + pay-only-shown-account warning, REF-XXXXXX reference IDs
  (P-refs internal, never shown), optional bank-ref field, no stock reservation (kept),
  accept/reject-reasons/overpay-choice/partial + in-app message thread, all-credit-first quote +
  coupons (validated, usage counted), cash-out requests from minimum, cancel reasons/requests.
- §4 orders: Pending→Confirmed→Packaged→On the way/Ready→Completed, bulk updates, completed by
  customer + in-app reminders (delays editable), notifications + per-type prefs, problem reports
  (48h), reviews (buyers only, immediate, hideable).
- §5 catalogue: dynamic nested-from-comma categories, price filter, sort, sold-out last + grey,
  wholesale tiers + live tier pricing, per-product add-ons with stock, 4-media display + zoom +
  no-download video, admin product editor (price/stock/threshold/discount/tiers/restock/media),
  time-based NEW/Restocked tags, discounts with dates + Discounts page, coupons with
  percent+expiry+limit, wishlist hearts + page, owner low-stock list.
- §6 accounts: customer sign-up/login (name/phone/email/password + T&C boxes), owner password
  reset, staff invite→join→approve (sees nothing until approved), owner-only gates on products/
  settings/customers/reports/coupons/staff, all-orders queue, dashboard numbers + CSV exports,
  activity log, nightly JSON backup (90 kept) + Supabase platform backups.
- §7 pages: Contact/Help+About (admin text), hours, announcement banner on/off, social links,
  footer links. §8: T&C + privacy plain-words sections, shop-view event collection.
- §9 PWA: manifest (plum/cream, icons), offline shell service worker, push handler stub
  (VAPID keys = later version), installable. Icons are simple placeholders.

## Openly deferred (owner-approved later versions)
Email/OTP sending, APK, Google sign-in, other integrations, auto AI verification, VAPID push keys,
delivery-fee auto-calc, rider/urgent flows, loyalty, analytics dashboards, promos beyond coupons,
recommendations, advanced search relevance, multi-admin fine roles beyond staff.

## Verification
- tsc clean, key pages 200 on :3001, ALL suites (phase0/1/4/5/5-add/strip/real/login-e2e/rls/
  supabase/v1-shop/v17-e2e) PASS, 0 FAIL. RLS 34/34.
