# PRD v1.1 — ARCHIVE, READ-ONLY — DO NOT BUILD FROM THIS
# Source: user instruction B. ARCHIVE v1.1. If conflicts with v1.2, v1.2 wins.

PRD — Lakky Variety Store App V1
Version: 1.1-draft [CHANGED from 1.0] | Date: 2026-10-04 [CHANGED] | Repo: https://github.com/fareedatomosalewa-web/Lakky-variety-store Status: DRAFT for owner review — do not build new scope until approved. Marks: [NEW] = added, [CHANGED] = edited. Items marked (proposed) = owner must confirm.

1. Overview & Goals
Mobile-first PWA shop + order-management for single-owner variety store. Manual bank-transfer flow, no customer accounts, no Play Store.

Customer journey: Browse → Product → Variant → Cart → Checkout → Pay externally → Upload proof → Pending (P-YYYY-0001) → Admin verify → Confirmed (LVS-001) → Reserve → Processing → Collect/Deliver → Completed

Stockpile journey: Confirmed → Reserved → 14-day free hold → Daily fee after Day 14 → Clear fee → Release
[NEW] Abandon path: fee_unpaid + no contact ≥ abandon_days (60) → flag Abandoned → admin decides release/forfeit

Success = owner can add products, verify payments, reserve stock correctly, enforce fees, fulfil per Order ID, without code.
[NEW] Money rule: every naira received is either on a Confirmed order or in Store Credit ledger. Never kept without a ledger entry.

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
[NEW] Checkout also shows: 14-day free hold + daily fee + abandon rule in plain text → required checkbox "I agree" → store agreed_at on order. Effect: fee disputes avoided.
Pay /pay/[ref]: bank details + Expected Transfer, inputs amount/date/time/ref + proof upload (≤5MB compressed). Zero-total (full credit) = no proof needed.
Track /orders: lookup requires Order ID + matching phone. Phone alone retrieves nothing. Timeline + stockpile card: confirm date, free-until, countdown, extra days, rate, fee, outstanding.
[CHANGED] Track rate-limit: 5 tries/hour/IP → lock 1 hr. Effect: sequential IDs (LVS-001) can't be brute-forced.

3.2 Admin (single admin, email+password Better Auth)
Dashboard: Pending-first queue + counts (Pending, Under/Over, Fee-due, Ready)
[NEW] Dashboard also: Abandoned flag count
Order detail: customer, lines snapshot, fulfilment, expected vs submitted + proof view, stockpile/fee, timeline, payment history (original + top-ups + fee payments + admin actions)
Verify: Confirm / Under / Over / Reject + verified_amount + verified_by audit. Atomic: INSERT orders FROM pending → available-=qty, reserved+=qty WHERE available>=qty — abort on race. Confirm generates LVS-001… sequential, never merged/reused.
[NEW] Verify checklist: admin confirms amount in bank app/SMS alert (NOT the screenshot) → tick "Seen in bank" → required before Confirm. Effect: fake proofs can't pass.
[NEW] Race loss (stock gone at verify): full amount → Store Credit auto + admin notified. Never leave customer paid with no order.
Under: no ID, no stock move, show outstanding, top-ups linked to same Pending until expiry → Rejected
[NEW] Under expired/Rejected: paid amount → Store Credit auto (ledger reason + Order ref).
Over: confirm + reserve, excess → auto-credit unless > threshold → manual review
Fees: global daily fee + per-product override, verify fee_payments per Order ID, block Ready/Out if fee_unpaid>0. Calc: free_until=confirmed_date(Africa/Lagos)+14d 23:59; fee=extra_days*rate — lib/domain.ts:1-12
[NEW] Abandon rule: fee_unpaid + no contact ≥ abandon_days (60) → flag "Abandoned" → admin decides release/forfeit (never automatic). Effect: stock not locked forever. Get a Nigerian lawyer/trade advisor to check forfeiture wording before launch.
Fulfilment: Pickup Processing→Packed→Ready→Collected→Completed; Delivery Processing→Packed→Out→Delivered→Completed; per Order ID only, no bulk force
[NEW] On every status change → "Send WhatsApp update" button (wa.me link, prefilled text with Order ID). No API, ₦0. Effect: customers get updates without accounts.
Products: CRUD, images, variant price/available, tags, activate/deactivate. Never edit reserved manually.
Credit: ledger +/- with reason, admin actor, related Order ID. Non-cashable V1. Usable at checkout.
Search & Recovery: filter by OrderID/phone/name/date/amount/ref, masked list → secondary checklist before disclose. No OTP, no auto-reveal.
Settings (all editable, no rebuild): bank details, fulfilment days, global fee, free_hold_days, overpayment_threshold, underpayment_expiry_days, pickup note — db/schema.ts:141-150
[NEW] Settings add: abandon_days (60)

3.3 Cross-cutting
Auth: customers no accounts. Phone = contact/matching ID only.
Notifications: in-app list only, no push [CHANGED: + manual WhatsApp button, see 3.2]
Cancellation: customer requests → admin approves only → paid→credit, stock returns, accrued fee due unless waived
Validation: NG phone, amounts>0 NGN ints, available>=0 DB check
Security: signed proof URLs, no ID enumeration, rate-limit lookup
Mobile: 360px-first, compressed images, low-data
[NEW] Resilience: daily automated DB backup → copy off-machine (not same PC) → restore test passed → admin password-reset steps documented. Effect: PC dies/locked out ≠ lost business.
Explicitly OUT of V1: auto delivery-fee, rider, urgent delivery, loyalty, analytics, auto AI verify (assist-only), multi-admin roles, promos, recommendations, advanced search.

4. Plan (Phases — current code already passes checks)
Phase 0 Setup — DONE: Next 14 + Drizzle + Better Auth + R2 SDK, lib/domain.ts, .env.example, Dockerfile, compose. Checks phase0-check.cjs PASSED.
Phase 1 Data — DONE: schema 15 tables, seeds, phase1-check.cjs PASSED (never-merge, credit, settings editable)
Phase 2 Shop — DONE: catalogue/cart/checkout/pay/track per acceptance
Phase 3 Admin — DONE: queue/verify/products/fees/fulfil/credit/search/settings
Phase 4 Harden — DONE: phase4-check.cjs PASSED (race, credit, expiry, phone)
Phase 5 UAT & Release — PENDING owner sign-off: time-travel fee test Sept1 vs Sept10 PASSED in phase5-check.cjs, but needs: 10 real products pilot, bank details FILL-IN, backup/restore test, handover read. See ACCEPTANCE_CHECKLIST.md, HANDOVER_GUIDE.md.
[NEW] Phase 5 add: build the NEW items above (money rule, abandon, agree checkbox, seen-in-bank, WhatsApp button, rate-limit, backup) → new checks → PASS before release.
[NEW] Do now: push code to GitHub (private repo). Don't wait for PRD approval. Effect: laptop dies ≠ lost work.
Note: original plans proposed Supabase+Vercel. Built stack is local-free: portable Node 24 + Drizzle + Postgres (pg-mem dev, PG16 prod-local) + R2 free tier + Tunnel. ₦0.
[NEW] Risk: local host + Tunnel → PC off = store down. Accept for pilot or move to cheap hosting later.

5. Open Questions (need your values to lock) — (proposed) answers added, owner edit/confirm
Order IDs: keep LVS-001 from 1 (built) or switch to LVS-0219 from 219? → (proposed) keep LVS-001
Global daily fee default ₦500 OK? Bulky overrides (freezer ₦2000) final values? → (proposed) ₦500; freezer ₦2000
Free hold 14 days OK? Per-Order flat (built) vs per-item/qty? → (proposed) 14d, per-Order flat
Can Store Credit pay retaining fees? → (proposed) YES
Overpayment auto-credit threshold: current 50000 OK? Large over = manual review? → (proposed) 50000; above = manual review
Underpayment expiry: current 7 days OK? Top-ups: one or multiple until expiry? Retry count? → (proposed) 7d; multiple top-ups until expiry
Pending stock: confirm first-verified-wins, no hold (built) — approve? → (proposed) YES + race-loss → auto-credit (see 3.2)
Cancel window: admin-only before Completed OK? Accrued fee waived or due? → (proposed) admin-only; due unless waived
Checkout fields: Pickup = name/phone/day; Delivery = +area/address/landmark/instructions — required vs optional? → OWNER DECIDES
Fulfilment days: Mon, Thu, Sat OK? Pickup note text? → OWNER DECIDES
Recovery disclose threshold: ≥4/6 fields match OK? → (proposed) ≥4/6
Add-ons need stock in V1? Current: no. → (proposed) no
Bank details: fill real bank/accountNumber/accountName in Settings (currently FILL-IN). → OWNER FILLS
Fee payment method: transfer + proof linked to same Order ID OK? → (proposed) YES
[NEW] Abandon days: 60 OK? → (proposed) 60
Once approved, lock into BUSINESS_RULES_LOCKED.md + settings defaults and push PRD.md to GitHub.
[CHANGED] Next: reply "approve + edits" (list any value you change) OR "save PRD.md locally only" OR "save + push to https://github.com/fareedatomosalewa-web/Lakky-variety-store". Nothing pushed yet.
