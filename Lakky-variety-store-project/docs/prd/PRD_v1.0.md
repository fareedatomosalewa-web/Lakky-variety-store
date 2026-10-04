# PRD v1.0 — ARCHIVE, READ-ONLY — DO NOT BUILD FROM THIS
# Source: user instruction A. ARCHIVE v1.0. If conflicts with v1.2, v1.2 wins.

PRD — Lakky Variety Store App V1
Version: 1.0-draft | Date: 2026-10-02 | Repo: https://github.com/fareedatomosalewa-web/Lakky-variety-store Status: DRAFT for owner review — do not build new scope until approved

1. Overview & Goals
Mobile-first PWA shop + order-management for single-owner variety store. Manual bank-transfer flow, no customer accounts, no Play Store.

Customer journey: Browse → Product → Variant → Cart → Checkout → Pay externally → Upload proof → Pending (P-YYYY-0001) → Admin verify → Confirmed (LVS-001) → Reserve → Processing → Collect/Deliver → Completed

Stockpile journey: Confirmed → Reserved → 14-day free hold → Daily fee after Day 14 → Clear fee → Release

Success = owner can add products, verify payments, reserve stock correctly, enforce fees, fulfil per Order ID, without code.

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
Cart /cart: variant-distinct lines, +/-/remove, live total sum(priceqty)-credit, NGN ints — lib/domain.ts:14-17
Checkout /checkout: full_name + phone required (+234 normalized), pickup|delivery, conditional area/address/landmark/instructions, preferred day, credit toggle, show Expected Transfer + require confirm
Pay /pay/[ref]: bank details + Expected Transfer, inputs amount/date/time/ref + proof upload (≤5MB compressed). Zero-total (full credit) = no proof needed.
Track /orders: lookup requires Order ID + matching phone. Phone alone retrieves nothing. Timeline + stockpile card: confirm date, free-until, countdown, extra days, rate, fee, outstanding.

3.2 Admin (single admin, email+password Better Auth)
Dashboard: Pending-first queue + counts (Pending, Under/Over, Fee-due, Ready)
Order detail: customer, lines snapshot, fulfilment, expected vs submitted + proof view, stockpile/fee, timeline, payment history (original + top-ups + fee payments + admin actions)
Verify: Confirm / Under / Over / Reject + verified_amount + verified_by audit. Atomic: INSERT orders FROM pending → available-=qty, reserved+=qty WHERE available>=qty — abort on race. Confirm generates LVS-001… sequential, never merged/reused.
Under: no ID, no stock move, show outstanding, top-ups linked to same Pending until expiry → Rejected
Over: confirm + reserve, excess → auto-credit unless > threshold → manual review
Fees: global daily fee + per-product override, verify fee_payments per Order ID, block Ready/Out if fee_unpaid>0. Calc: free_until=confirmed_date(Africa/Lagos)+14d 23:59; fee=extra_daysrate — lib/domain.ts:1-12
Fulfilment: Pickup Processing→Packed→Ready→Collected→Completed; Delivery Processing→Packed→Out→Delivered→Completed; per Order ID only, no bulk force
Products: CRUD, images, variant price/available, tags, activate/deactivate. Never edit reserved manually.
Credit: ledger +/- with reason, admin actor, related Order ID. Non-cashable V1. Usable at checkout.
Search & Recovery: filter by OrderID/phone/name/date/amount/ref, masked list → secondary checklist before disclose. No OTP, no auto-reveal.
Settings (all editable, no rebuild): bank details, fulfilment days, global fee, free_hold_days, overpayment_threshold, underpayment_expiry_days, pickup note — db/schema.ts:141-150

3.3 Cross-cutting
Auth: customers no accounts. Phone = contact/matching ID only.
Notifications: in-app list only, no push
Cancellation: customer requests → admin approves only → paid→credit, stock returns, accrued fee due unless waived
Validation: NG phone, amounts>0 NGN ints, available>=0 DB check
Security: signed proof URLs, no ID enumeration, rate-limit lookup
Mobile: 360px-first, compressed images, low-data
Explicitly OUT of V1: auto delivery-fee, rider, urgent delivery, loyalty, analytics, auto AI verify (assist-only), multi-admin roles, promos, recommendations, advanced search.

4. Plan (Phases — current code already passes checks)
Phase 0 Setup — DONE: Next 14 + Drizzle + Better Auth + R2 SDK, lib/domain.ts, .env.example, Dockerfile, compose. Checks phase0-check.cjs PASSED.
Phase 1 Data — DONE: schema 15 tables, seeds, phase1-check.cjs PASSED (never-merge, credit, settings editable)
Phase 2 Shop — DONE: catalogue/cart/checkout/pay/track per acceptance
Phase 3 Admin — DONE: queue/verify/products/fees/fulfil/credit/search/settings
Phase 4 Harden — DONE: phase4-check.cjs PASSED (race, credit, expiry, phone)
Phase 5 UAT & Release — PENDING owner sign-off: time-travel fee test Sept1 vs Sept10 PASSED in phase5-check.cjs, but needs: 10 real products pilot, bank details FILL-IN, backup/restore test, handover read. See ACCEPTANCE_CHECKLIST.md, HANDOVER_GUIDE.md.
Note: original plans proposed Supabase+Vercel. Built stack is local-free: portable Node 24 + Drizzle + Postgres (pg-mem dev, PG16 prod-local) + R2 free tier + Tunnel. ₦0.

5. Open Questions (need your values to lock)
Order IDs: keep LVS-001 from 1 (built) or switch to LVS-0219 from 219 (old docs example)?
Global daily fee default ₦500 OK? Bulky overrides (freezer ₦2000) final values?
Free hold 14 days OK? Per-Order flat (built) vs per-item/qty?
Can Store Credit pay retaining fees? Proposal: YES.
Overpayment auto-credit threshold: current 50000 OK? Large over = manual review?
Underpayment expiry: current 7 days OK? Top-ups: one or multiple until expiry? Retry count?
Pending stock: confirm first-verified-wins, no hold (built) — approve?
Cancel window: admin-only before Completed OK? Accrued fee waived or due? Default: due unless waived.
Checkout fields: Pickup = name/phone/day; Delivery = +area/address/landmark/instructions — required vs optional?
Fulfilment days: Mon, Thu, Sat OK? Pickup note text?
Recovery disclose threshold: ≥4/6 fields match OK?
Add-ons need stock in V1? Current: no.
Bank details: fill real bank/accountNumber/accountName in Settings (currently FILL-IN).
Fee payment method: transfer + proof linked to same Order ID OK?
Once you approve, I will lock into BUSINESS_RULES_LOCKED.md + settings defaults and push PRD.md to GitHub.

Next: tell me approve + edits or save PRD.md locally only or save + push to https://github.com/fareedatomosalewa-web/Lakky-variety-store. I have NOT pushed anything yet.
