# IMPLEMENTATION PLAN — Lakky Variety Store App V1

> Source: PRD Lakky Variety Store App — Version 1 (42 sections).
> Status: Planning only. No code changed. Awaiting approval on stack + business rules before Phase 0 build.

## 0. Folder Review

`C:\Users\lakky\Documents\Default Project\`:

- `Lakky-variety-store-project/` — `.git/` + `README.md` only. No code. **Use as V1 repo.**
- `my-first-project/` — `.git/` only. No code. Leave untouched / archive.

Working repo for V1: `Lakky-variety-store-project/`.

## 1. Product Summary (from PRD)

Mobile-friendly shopping + order-management app.

Customer journey:
`Browse → Product → Variant → Cart → Checkout (name/phone/pickup|delivery) → See payment details → Pay externally → Upload proof → Pending → Admin verify → Confirmed → Order ID → Reserve stock → Processing → Collect/Deliver → Completed`

Stockpile journey:
`Confirmed → Order ID → Reserved → 14-day free hold → Daily retaining fee after Day 14 → Request fulfilment → Clear fee → Release → Collected/Delivered`

Core invariants:
- Browse without account. Account/identity required at checkout.
- Stock at variant-combination level. Unavailable combos not selectable.
- `Confirmed → Order ID → Reserve`. Pending moves no stock.
- Every confirmed payment = unique Order ID. Never merge.
- Each Order ID has independent 14-day hold + fee.
- No release if retaining fee unpaid.
- Underpayment blocks processing. Overpayment may become Store Credit.
- Cancellation post-confirmation → Store Credit, not auto cash. Seller errors via admin review.
- V1 records pickup/delivery choice. No auto delivery-fee calc.
- Recovery via support with 2-step manual verification. No OTP, no auto-reveal.
- Single admin/owner for V1.

Out of V1 (§39): delivery-fee calc, rider system, urgent delivery, loyalty, analytics, auto AI verification, segmentation, multi-admin roles, promos, recommendations.

---

## 2. Architectural Decisions

### 2.1 Recommended stack

**Option A — Recommended: Next.js App Router + Supabase + Vercel**

- One codebase: `/(shop)` public storefront, `/admin` private console.
- Backend: Supabase Postgres + Auth + Storage.
- RLS: customers see own orders, admin sees all.
- Storage buckets:
  - `product-images` — public read
  - `payment-proofs` — private, signed URLs, admin + owning customer only
- Hosting: Vercel (app) + Supabase (DB/storage/cron).
- PWA manifest for mobile install, no app-store needed.

Why: fits manual bank-transfer flow, variant stock transactions, image uploads, fee cron, single admin, low data use, owner can manage via UI without code.

**Option B: Vite React + Supabase** — lighter but no SSR, weaker SEO, extra PWA work. Fallback if Next.js feels heavy.

**Option C: Flutter + Firebase** — needs Play Store, heavier for V1, slower iteration. Reject for V1.

**Option D: WordPress/WooCommerce** — fast catalogue but stockpile/fee/never-merge logic becomes hacky. Reject for V1.

> Decision needed: Approve Option A.

### 2.2 Auth model V1

- Browse: guest. Cart in localStorage.
- Checkout: require `full_name + active_phone`. Normalize NG phones to `+234...`.
- Identity: `customers` row keyed by phone. Orders linked by `customer_id`.
- My Orders: lookup by `phone + Order ID`.
- Customer accounts: no password / OTP in V1 (per no-OTP constraint). Claim-account / PIN deferred.
- Admin: single Supabase Auth `email+password` user with `is_admin=true`. All `/admin` routes + RLS admin-only.

> Decision needed: Approve phone-link + single admin.

### 2.3 Order ID & Pending Ref

- `orders.display_id`: `LVS-0219` style, sequential integer starting at 219 to match PRD examples (#219, #220, #221). DB `UNIQUE`, immutable, never reused even if cancelled/rejected.
- `pending_refs.ref`: `P-2026-0001` style. Displayed pre-confirmation. Never fulfilable, never confused with Order ID.
- Generation: Order ID created only inside confirm-transaction.

> Decision needed: Approve `LVS-####` from 219 + `P-...` split.

### 2.4 Fee calculation

```text
confirmed_date = date(confirmed_at, Africa/Lagos)
free_until = confirmed_date + 14 days 23:59
extra_days = max(0, today_lagos - free_until_date)
daily_rate = coalesce(max(product_override_in_order), global_daily_fee)
current_fee = extra_days * daily_rate
```

- Pure function `calcFee(confirmed_at, today, global_rate, overrides[])` — unit tested.
- Display on-read + nightly cron materializes for admin list.
- Release blocked if `fee_unpaid > 0`.

> Decisions needed: per-Order flat vs per-item/qty, global rate value, bulky override values, can Store Credit pay fees?

### 2.5 Notifications V1

In-app `notifications` table + bell list. No FCM/push in V1.

Cover: order received, pending, confirmed, underpayment, overpayment, processing, packed, ready/out, delivered/completed, stockpiled, holding approaching/ended, fee started/updated, new/restocked (manual).

Admin New Order Received → opens Order Details.

---

## 3. Data Model V1

```sql
-- conceptual, migrations in Phase 1
products(id, name, description, base_price NGN int, status, active bool, fee_override NGN nullable)
product_images(id, product_id FK, url, sort)
variant_skus(id, product_id FK, attrs JSONB, price NGN, available int, reserved int, active bool, UNIQUE(product_id, attrs))
addons(id, name, price NGN, active bool) -- no stock in V1
customers(id, full_name, phone TEXT UNIQUE, credit_balance NGN, created_at)
pending_refs(id, ref TEXT UNIQUE, customer_id FK, fulfilment JSONB, expected_total NGN, credit_applied NGN, status, created_at)
pending_items(id, pending_id FK, variant_sku_id FK nullable, addon_id FK nullable, qty, unit_price_snapshot NGN)
payment_submissions(id, pending_id FK, amount_claimed NGN, transfer_date DATE, transfer_time TIME, reference TEXT, proof_url TEXT, status)
orders(id, order_number INT UNIQUE, display_id TEXT UNIQUE, customer_id FK, pending_id FK, total NGN, paid_amount NGN, payment_status, fulfilment_method, fulfilment_details JSONB, fulfilment_status, confirmed_at TIMESTAMPTZ, free_until DATE, stockpile_status, created_at)
order_items(id, order_id FK, variant_sku_id FK, addon_id FK nullable, qty, unit_price_snapshot NGN)
credit_ledger(id, customer_id FK, order_id FK nullable, amount INT +/-, reason, created_by_admin UUID, created_at)
fee_payments(id, order_id FK, amount NGN, proof_url, status, verified_by)
settings(id, bank_details JSONB, global_daily_fee NGN, fulfilment_days JSONB, pickup_note TEXT)
notifications(id, customer_id FK nullable, order_id FK nullable, type TEXT, message TEXT, read bool, created_at)
```

Transactions:

- `verify_confirm(pending_id)`: `INSERT orders + order_items FROM pending snapshot → UPDATE variant_skus SET available -= qty, reserved += qty WHERE available >= qty → generate order_number → INSERT notification`. Abort on insufficient stock → flag exception.
- `approve_cancel(order_id)`: `UPDATE variant_skus SET reserved -= qty, available += qty → INSERT credit_ledger +paid_amount → UPDATE orders SET status=cancelled, stockpile closed`.

Snapshots: order stores price/qty/variant copy. Later admin price edits do not affect existing orders.

---

## 4. App Structure (proposed)

```text
/app/(shop)/page.tsx            catalogue mixed grid
/app/(shop)/p/[id]/page.tsx     product detail + variant + addon + Add to Cart
/app/(shop)/cart/page.tsx       cart
/app/(shop)/checkout/page.tsx   checkout
/app/(shop)/pay/[ref]/page.tsx  payment details + upload
/app/(shop)/orders/page.tsx     lookup by phone + ID
/app/(shop)/orders/[id]/page.tsx tracking + stockpile card
/app/admin/login/page.tsx
/app/admin/page.tsx             queue Pending-first
/app/admin/orders/[id]/page.tsx full record + verify + fulfil + fees + credit + recovery search
/app/admin/products/...         CRUD + images + variants + stock + status tags
/app/admin/settings/page.tsx    bank, fulfilment days, fees
/lib/fees.ts                    calcFee()
/lib/totals.ts                  cart/order totals, under/over diff
/lib/ids.ts                     Order ID / Pending Ref formatting
/components/...                 ProductCard, VariantPicker, CartDrawer, FeeBadge, StatusTimeline
supabase/migrations/...         schema + RLS + storage policies + seeds
tests/...                       fees, totals, reserve/release
```

---

## 5. Phased Build

### Phase 0 — Setup & Lock (no features)

- Clean `main`, `.gitignore`, Next.js + Tailwind + PWA manifest + lint/format.
- Supabase project, env `.env.local`, buckets `product-images` / `payment-proofs`, RLS skeleton.
- Preview deploy.
- Lock open business rules (list in §8).
- Exit: `npm run dev` renders empty catalogue + admin login shell.

### Phase 1 — Domain + DB

- Migrations for all tables, RLS, storage policies, seeds:
  - Handbag: Black+4"=10000, Black+9"=12000, White+4" avail 2, White+5" avail 0
  - Add-on: Gift box 2000
  - Settings: dummy bank, `global_daily_fee` e.g. 500, freezer override, fulfilment days
- Unit tests: totals, under/over, fee Day 14/15 boundary Africa/Lagos, reserve/release.
- Exit: tests pass, fee math signed off.

### Phase 2 — Storefront

- `/` catalogue: image, name, from-price, status.
- Product page: attribute pickers, disable 0-stock combos, addon checkbox, Add to Cart stays on page, cart badge.
- Cart: product/variant/addon/qty/unit/total, +/-/remove, live total, merge same variant, keep variants distinct.
- Checkout: name, phone, pickup|delivery, conditional location/area/landmark/address/instructions, preferred day from settings, credit toggle, Expected Transfer display.
- Pay: show bank details + Expected Transfer, upload proof (≤5MB, compressed) + amount/date/time/ref → Pending Ref.
- Orders: lookup + detail timeline `Pending → Confirmed → Processing → Packed → Ready/Out → Collected/Delivered → Completed`, stockpile card: confirm date, free-end, countdown, extra days, fee, outstanding.
- Exit: PRD §38 Catalogue/Cart/Payment checks pass.

### Phase 3 — Admin Console

- Login, dashboard queue Pending-first, badge counts.
- Order detail (§34): customer, order lines, fulfilment, payment expected vs submitted + proof view, stockpile (confirm date, free days left, fee), status timeline.
- Actions: Confirm / Underpayment + outstanding / Overpayment + excess → credit / Rejected, enter verified amount, auto Order ID + reserve + notify.
- Stockpile view, fee config global + per-product override, fee payment verify, block `Ready/Out` if fee due.
- Fulfilment buttons per pickup vs delivery track.
- Products: CRUD, images, variant price/stock, New/Restocked/OutOfStock/Unavailable tags, activate/deactivate.
- Credit: balance per customer, add/deduct with reason, history.
- Search: Order ID / phone / name / date / amount / ref. Recovery mode: masked ID until secondary checklist passes.
- Settings: bank details, fulfilment days, fees, pickup note.
- Exit: Confirm→ID→Reserve + individual fulfil verified.

### Phase 4 — Cross-cutting Hardening

- Notifications list both sides.
- Cancellation: customer request → admin approve → stock return + credit, fee already accrued stays unless waived. Pending → Rejected to close.
- Validation: NG phone, amounts in NGN ints, no negative stock (DB check constraints).
- Security: signed proof URLs, no ID enumeration, rate-limit lookup, audit `verified_by`.
- Perf/mobile: image resize, 360px QA, low-data mode.
- Explicitly NOT: delivery calc, rider, urgent flow, loyalty, analytics, auto AI verify (assist only), roles, promos, recommendations, advanced search/filters.

### Phase 5 — UAT & Release

Map PRD §38 acceptance:
- Catalogue: see products, view info, select available, blocked unavailable.
- Cart: add multiples, change qty, remove, auto total.
- Payment: submit, upload, Pending, admin verify → Confirmed.
- Order ID: unique, separate payments separate IDs, lines identifiable.
- Stock: confirmed reserves, reserved hidden from available, available vs reserved correct.
- Stockpile: mark held, customer sees, per-order 14d, auto fee daily, visible fee, blocked release if unpaid.
- Fulfilment: individual IDs, no bulk force, pickup/delivery tracked, Completed terminal.
- Recovery: search by payment, no instant reveal, secondary check, alternative path.

Include time-travel fee test (Sept 1 vs Sept 10 orders), last-unit race test, under/over/reject scripts, pilot with 10 real products, backup/restore, owner handover doc (add product without code).

---

## 6. V1 Scope Guardrails

Do NOT build: auto delivery fee, rider integration, urgent scheduling, loyalty, analytics dashboards, automated AI verification, segmentation, staff permissions, campaigns, recommendations, complex search/filters (basic mixed grid only), auto refunds to cash, OTP/self-serve recovery, auto cancellation.

AI/OCR: assist-only for reading receipts, never final authority.

---

## 7. Risks & Mitigations

- Last-unit race (no Pending hold) → first-verified-wins + clear under/reject messaging.
- Fee disputes → always show confirm date, free-end, extra days, rate, total.
- Proof image data → client compress, 5MB cap.
- Phone identity collision → normalize +234, verify name/phone at handover.
- Price edits mid-pending → snapshot at checkout, verify against snapshot.

---

## 8. Decisions Needed Before Phase 0

1. Stack A approved?
2. Repo = `Lakky-variety-store-project`?
3. Auth = phone-link + single admin, no OTP?
4. Order ID `LVS-0219` from 219 + Pending `P-...`?
5. Pending: hold stock or first-verified-wins? Top-up link? Expiry days? Retry count?
6. Overpayment: auto-credit? Large threshold for manual refund?
7. Fee: per-Order flat? Global rate? Bulky overrides? Credit usable for fees?
8. Fee payment: transfer + proof linked to same Order ID?
9. Cancel window + approver? Accrued fee waived or due?
10. Pickup/delivery required vs optional fields + fulfilment days list?
11. Recovery sufficient-match minimum (e.g. 4/6 fields)?
12. Add-ons need stock tracking in V1?

Once approved, these become locked wording and Phase 0 starts.
