# PRD — Lakky Variety Store App V1 — v1.2 ACTIVE — BUILD ONLY FROM THIS
# Version: 1.2 | Date: 2026-10-04 | Repo: https://github.com/fareedatomosalewa-web/Lakky-variety-store
# Status: APPROVED by owner. If archive and v1.2 conflict → v1.2 wins.
# Rules: bank details, fulfilment days, pickup note live ONLY in admin Settings DB, seed FILL-IN, never hardcode. Backup location DEFERRED to v1.3.

PRD — Lakky Variety Store App V1
Version: 1.2 | Date: 2026-10-04 | Repo: https://github.com/fareedatomosalewa-web/Lakky-variety-store
Status: APPROVED by owner. Items marked OWNER = owner must supply value.

1. Overview & Goals
Mobile-first PWA shop + order-management for single-owner variety store. Manual bank-transfer flow, no customer accounts, no Play Store.

Customer journey: Browse → Product → Variant → Cart → Checkout → Pay externally → Upload proof → Pending (P-YYYY-0001) → Admin verify → Confirmed (LVS-009-9270) → Reserve → Processing → Collect/Deliver → Completed

Stockpile journey: Confirmed → Reserved → 14-day free hold → Daily fee after Day 14 → Clear fee → Release
Abandon path: fee_unpaid + no contact ≥ abandon_days (60) → flag Abandoned → admin decides release/forfeit (never automatic)

Success = owner can add products, verify payments, reserve stock correctly, enforce fees, fulfil per Order ID, see daily reports, without code.
Money rule: every naira received is either on a Confirmed order or in Store Credit ledger. Never kept without a ledger entry.

2. Goods (Catalogue)
Model: products + product_images + variant_skus(attrs JSONB, price, available, reserved) + addons — db/schema.ts:24-54

Current seeds (db/seed.ts:2-15):
Handbag - base ₦10,000:
Black / 4" — ₦10,000, avail 5
Black / 9" — ₦12,000, avail 5
White / 4" — ₦10,000, avail 2
White / 5" — ₦10,000, avail 0 (disabled / not selectable)
Add-on: Gift box — ₦2,000, no stock tracking in V1
Example bulky override: freezer @ ₦2,000/day (configurable)
Rules:
Stock lives at variant-combination level. 0-stock = disabled.
Products have status: New / Restocked / OutOfStock / Unavailable, active flag, optional fee_override.
Prices snapshot at checkout — later admin edits don't affect pending/confirmed orders.
V1: any goods sellable via name/desc/price/variants/images. No categories/search/filters.

3. Features
3.1 Storefront (no login to browse)
Catalogue /: mixed grid, image, name, from-price, status
Product /p/[id]: variant pickers, 0-stock disabled, addon checkbox, Add stays on page, cart badge
Cart /cart: variant-distinct lines, +/-/remove, live total sum(price*qty)-credit, NGN ints — lib/domain.ts:14-17
Checkout /checkout: full_name + phone required (+234 normalized), pickup|delivery, conditional area/address/landmark/instructions, preferred day, credit toggle, show Expected Transfer + require confirm
Checkout also shows: 14-day free hold + daily fee + abandon rule in plain text → required checkbox "I agree" → store agreed_at on order.
Pay /pay/[ref]: bank details + Expected Transfer, inputs amount/date/time/ref + proof upload (≤5MB compressed). Zero-total (full credit) = no proof needed.
Track /orders: lookup requires Order ID + FULL matching phone. Phone alone retrieves nothing. Timeline + stockpile card: confirm date, free-until, countdown, extra days, rate, fee, outstanding.
Track rate-limit: 5 wrong tries/hour/IP → lock 1 hr.

3.2 Admin (single admin, email+password Better Auth)
Dashboard: Pending-first queue + counts (Pending, Under/Over, Fee-due, Ready, Abandoned)
Order detail: customer, lines snapshot, fulfilment, expected vs submitted + proof view, stockpile/fee, timeline, payment history (original + top-ups + fee payments + admin actions)
Verify: Confirm / Under / Over / Reject + verified_amount + verified_by audit. Atomic: INSERT orders FROM pending → available-=qty, reserved+=qty WHERE available>=qty — abort on race.
Order ID on Confirm: LVS-{serial}-{last4 of phone}, e.g. LVS-009-9270. serial = GLOBAL across all customers, sequential, min 3 digits, never merged/reused. last4 = last 4 digits of phone given at checkout.
Verify checklist: admin confirms amount in bank app/SMS alert (NOT the screenshot) → tick "Seen in bank" → required before Confirm.
Race loss (stock gone at verify): full amount → Store Credit auto + admin notified.
Under: no ID, no stock move, show outstanding, top-ups linked to same Pending until expiry → Rejected
Under expired/Rejected: paid amount → Store Credit auto (ledger reason + Order ref).
Over: confirm + reserve, excess → auto-credit unless > threshold → manual review
Fees: global daily fee + per-product override, verify fee_payments per Order ID, block Ready/Out if fee_unpaid>0. Calc: free_until=confirmed_date(Africa/Lagos)+14d 23:59; fee=extra_days*rate — lib/domain.ts:1-12
Abandon rule: fee_unpaid + no contact ≥ abandon_days (60) → flag "Abandoned" → admin decides release/forfeit. Nigerian lawyer/trade advisor to check forfeiture wording before launch.
Fulfilment: Pickup Processing→Packed→Ready→Collected→Completed; Delivery Processing→Packed→Out→Delivered→Completed; per Order ID only, no bulk force
On every status change → "Send WhatsApp update" button (wa.me link, prefilled text with Order ID). Admin presses send. No API, no auto-send, ₦0.
Products: CRUD, images, variant price/available, tags, activate/deactivate. Never edit reserved manually.
Credit: ledger +/- with reason, admin actor, related Order ID. Non-cashable V1. Usable at checkout.
Search & Recovery: filter by OrderID/phone/last4 phone/name/date/amount/ref, masked list → secondary checklist before disclose. No OTP, no auto-reveal.
Reports page: pick date or range → shows:
 orders placed, approved, rejected, under/over, cancelled
 pickup vs delivery counts, stockpile active, fees due/paid
 total ₦ verified, credit issued/used
 export CSV
 Source = own database. Works for any past date, years later.
Settings (all editable, no rebuild): bank details, fulfilment days, global fee, free_hold_days, overpayment_threshold, underpayment_expiry_days, abandon_days (60), pickup note — db/schema.ts:141-150

3.3 Cross-cutting
Auth: customers no accounts. Phone = contact/matching ID only.
Notifications: in-app list only, no push + manual WhatsApp button (see 3.2)
Cancellation: customer requests → admin approves only → paid→credit, stock returns, accrued fee due unless waived
Validation: NG phone, amounts>0 NGN ints, available>=0 DB check
Security: signed proof URLs, no ID enumeration, rate-limit lookup
Mobile: 360px-first, compressed images, low-data
Data retention: keep ALL records forever. No auto-delete, no cleanup jobs. Orders never removed, only status-changed (Cancelled/Rejected). History viewable years later.
Backup & resilience:
 Code → GitHub, private. NEVER push .env, passwords, DB dumps, customer data.
 Database → daily automated dump → copy to off-machine location → keep ≥ 90 days of dumps → monthly restore test.
 Proof images (R2) → included in backup plan.
 Admin password-reset steps documented in HANDOVER_GUIDE.md.
Explicitly OUT of V1: auto delivery-fee, rider, urgent delivery, loyalty, auto AI verify (assist-only), multi-admin roles, promos, recommendations, advanced search, visitor/click tracking (LATER: add free tool e.g. Cloudflare Web Analytics).

4. Plan (Phases)
Phase 0 Setup — DONE: Next 14 + Drizzle + Better Auth + R2 SDK, lib/domain.ts, .env.example, Dockerfile, compose. phase0-check.cjs PASSED.
Phase 1 Data — DONE: schema 15 tables, seeds, phase1-check.cjs PASSED (never-merge, credit, settings editable)
Phase 2 Shop — DONE: catalogue/cart/checkout/pay/track per acceptance
Phase 3 Admin — DONE: queue/verify/products/fees/fulfil/credit/search/settings
Phase 4 Harden — DONE: phase4-check.cjs PASSED (race, credit, expiry, phone)
Phase 5 UAT & Release — PENDING owner sign-off: time-travel fee test Sept1 vs Sept10 PASSED in phase5-check.cjs; still needs: 10 real products pilot, bank details FILL-IN, backup/restore test, handover read. See ACCEPTANCE_CHECKLIST.md, HANDOVER_GUIDE.md.
Phase 5 add (BUILD THESE): money rule, race-loss → credit, under-expired → credit, abandon flag + abandon_days, agree checkbox + agreed_at, seen-in-bank checklist, WhatsApp button, track rate-limit, new Order ID format, last4 search, Reports page + CSV, retention (no deletes), daily backup. Write new checks → PASS before release. Do not break existing PASSED checks.
Stack note: local-free: portable Node 24 + Drizzle + Postgres (pg-mem dev, PG16 prod-local) + R2 free tier + Tunnel. ₦0. Supabase+Vercel plan is dropped.
Risk: local host + Tunnel → PC off = store down. Accept for pilot, move to cheap hosting later.

5. Locked Business Rules (defaults, editable in Settings)
Order ID → LVS-{global serial}-{last4 phone}
Global daily fee → ₦500; freezer override → ₦2,000
Free hold → 14 days; per-Order flat (not per item)
Store Credit can pay retaining fees → YES
Overpayment auto-credit threshold → ₦50,000; above → manual review
Underpayment expiry → 7 days; multiple top-ups allowed until expiry
Pending stock → first-verified-wins, no hold; loser → auto Store Credit
Cancel → admin-only before Completed; accrued fee due unless waived
Recovery disclose threshold → ≥4 of 6 fields match
Add-ons → no stock tracking in V1
Fee payment → transfer + proof linked to same Order ID
Abandon days → 60
OWNER to supply in app Settings only (never hardcode, seed FILL-IN): checkout required-vs-optional fields, fulfilment days + pickup note, real bank details (bank/accountNumber/accountName). Backup location DEFERRED to v1.3.
