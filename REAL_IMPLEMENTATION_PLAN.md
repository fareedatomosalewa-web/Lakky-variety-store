# REAL IMPLEMENTATION PLAN — Lakky Variety Store App V1

> Source: PRD V1 (42 sections) + IMPLEMENTATION_PLAN.md
> Format: Professional tech-stack tables — Domain | Recommendation | Reason
> Status: Planning only. No code changed.

## 1. Architecture & Stack

| Domain | Recommendation | Reason |
|---|---|---|
| App type | Single PWA web app, not native | Mobile-friendly, no Play Store delay, low data use, one codebase for shop + admin |
| Frontend framework | Next.js App Router + Tailwind CSS | SSR for catalogue SEO, route groups `/(shop)` + `/admin`, PWA-ready, fast iteration |
| Backend / DB | Supabase Postgres + RLS | Transactions for reserve/release, RLS for customer vs admin isolation, free-tier friendly |
| Auth | Supabase Auth (admin email+password only) + phone-link for customers | Single admin for V1, customers identified by phone at checkout, no OTP per constraint |
| Storage | Supabase Storage: `product-images` (public), `payment-proofs` (private, signed URLs) | Product images fast + proofs secure, admin + owner only |
| Hosting | Vercel (frontend) + Supabase (DB/storage/cron) | Preview deploys, zero DevOps, scales to V1 traffic |
| PWA | Manifest + service worker, installable, 360px-first | Owner + customers primarily on smartphones |
| Fallback stack | Vite React + Supabase | Lighter if Next.js feels heavy, but loses SSR/SEO |
| Rejected | Flutter/Firebase, WordPress/Woo | Native overhead / hacky stockpile + fee + never-merge logic |

## 2. Data & Domain Model

| Domain | Recommendation | Reason |
|---|---|---|
| Product | `products(id, name, desc, base_price NGN int, status, active, fee_override nullable)` | Base listing, status tags New/Restocked/OutOfStock/Unavailable, bulky override |
| Images | `product_images(id, product_id, url, sort)` | Multiple images, ordered, compressed ≤5MB |
| Variants | `variant_skus(id, product_id, attrs JSONB, price, available, reserved, active)` + `UNIQUE(product_id, attrs)` | Stock belongs to combination (e.g. Black+9"), prevents duplicate SKUs, 0-stock = disabled |
| Add-ons | `addons(id, name, price, active)` — no stock in V1 | Gift box etc. adds to total, avoids stock complexity |
| Customers | `customers(id, full_name, phone UNIQUE, credit_balance)` — normalize to +234 | Phone is V1 identity key, links orders + credit without password |
| Pending orders | `pending_refs(ref P-2026-0001 UNIQUE) + pending_items + payment_submissions` | Pre-verification container, never fulfilable, holds snapshot + proof |
| Confirmed orders | `orders(order_number seq from 219, display_id LVS-0219 UNIQUE, total, paid_amount, payment_status, fulfilment_method/details/status, confirmed_at, free_until, stockpile_status)` + `order_items` snapshot | Unique never-merge ID, full Order Record per §20, price snapshot immune to later edits |
| Payments | `payment_submissions(amount_claimed, transfer_date/time, reference, proof_url)` — admin enters `verified_amount` | Compares expected vs actual to derive Confirmed/Under/Over/Rejected |
| Store credit | `credit_ledger(customer_id, order_id nullable, amount +/-, reason, created_by_admin)` | Audit trail for overpayment/cancellation/adjustment/use, balance = sum |
| Fees | `settings(global_daily_fee, fulfilment_days, bank_details)` + `fee_payments(order_id, amount, proof_url, status)` | Global + per-product override, fee paid via transfer + proof linked to same Order ID |
| Notifications | `notifications(customer_id, order_id, type, message, read)` in-app list only | Covers §29 V1 subset, no FCM/push, admin New Order → opens detail |

## 3. Core Business Logic

| Domain | Recommendation | Reason |
|---|---|---|
| Totals | `total = sum(variant_price*qty) + sum(addon_price*qty) - credit_applied`, integers in NGN | Auto-calc, avoids float errors, live cart total |
| Payment verify | Transaction: `INSERT orders FROM pending → UPDATE variant_skus available-=qty, reserved+=qty WHERE available>=qty → INSERT notification` | Atomic Confirm→ID→Reserve, aborts on race → exception queue |
| Underpayment | No Order ID, no stock move, show outstanding, one top-up linked to same Pending Ref, expire after X days → Rejected | Blocks processing per §16, gives recovery path without new checkout |
| Overpayment | Confirm + Order ID + reserve, excess → auto credit unless > threshold → manual review | Meets requirement + policy, handles large overpayments separately |
| Rejected | Closed, no stock move, one re-upload allowed else new checkout | Prevents spam, clear retry rule |
| Stock return | On approved cancel: `reserved-=qty, available+=qty` | Frees physical stock correctly |
| Fee calc | `free_until = date(confirmed_at, Africa/Lagos)+14d 23:59; extra_days=max(0,today-free_until); fee=extra_days*coalesce(max override, global)` | Per-Order independent, timezone-explicit, testable pure function |
| Fee block | Block `Ready/Out` if `fee_unpaid>0`, fee keeps accruing on attempted collection | Enforces §24 no-release rule |
| Cancellation | Request by customer → approve by admin only → paid → credit, accrued fee stays unless waived, stockpile closed | No auto cash refund, seller errors via review |
| Fulfilment | Pickup: `Processing→Packed→Ready→Collected→Completed`; Delivery: `Processing→Packed→Out→Delivered→Completed`; Stockpile: `Confirmed→Held→Fee?→Ready→Collected/Delivered→Completed` | Individual Order IDs, trackable, matches §27 |
| Recovery | Admin search by date/amount/ref/phone → masked candidates → secondary checklist (name/phone/products/fulfilment) ≥4 matches → disclose | 2-step manual, no OTP, no auto-reveal per §30-31 |

## 4. Storefront (Customer)

| Domain | Recommendation | Reason |
|---|---|---|
| Catalogue `/` | Mixed grid, image/name/from-price/status | Immediate availability per §7, no forced category |
| Product `/p/[id]` | Variant pickers + disable 0-stock + addon checkbox + Add stays on page + badge | Variant-level price/stock, cart UX per §11 |
| Cart `/cart` | Lines with variant/addon/qty/unit/total, +/-/remove, live total, merge same variant | Monitor spending, distinguish variants |
| Checkout `/checkout` | Name + phone (required), pickup\|delivery radio, conditional area/address/landmark/instructions, preferred day from settings, credit toggle, Expected Transfer | Collects §12 fields, shows required upfront, credit optional |
| Pay `/pay/[ref]` | Show bank details + Expected Transfer, inputs amount/date/time/ref + proof upload compressed | External pay + proof flow per §14 |
| Orders `/orders` | Lookup by phone + Order ID, list + detail timeline + stockpile card (confirm date, free-end, countdown, extra days, fee, outstanding) | Traceability: bought→paid→ID→where→fee→how to collect |
| Validation | NG phone format, amount>0, proof required unless zero-total (full credit) → auto-confirm | Prevents bad data, handles 100% credit edge |

## 5. Admin Console (Single Owner)

| Domain | Recommendation | Reason |
|---|---|---|
| Dashboard | Queue Pending-first + counts (Pending, Under/Over, Fee-due, Ready) | Focus on payments needing verification |
| Order detail | Full §34 record: customer, lines snapshot, fulfilment, expected vs submitted + proof view, stockpile dates + fee, timeline | Single source of truth for verify + fulfil + recovery |
| Verify actions | Buttons Confirm / Under / Over / Reject + verified_amount field + audit `verified_by` | Manual authority, AI assist-only, never auto-confirm |
| Products | CRUD + image upload + activate/deactivate + status tags | Owner manages without code per maintainability |
| Variants & stock | Edit option values, variant price, available count, view Available vs Reserved | Variant-level control, accurate stock |
| Fees | Edit global daily fee + per-product override, view extra_days/fee, verify fee_payments | Configurable per §25, transparent calc |
| Fulfilment | Update status buttons, edit pickup/delivery info, configure fulfilment days | Manage pickup + configurable days, no hard-code |
| Credit | View balance/customer, add/deduct with reason, history | Manage overpayment/cancellation/adjustments |
| Search & recovery | Filter by OrderID/phone/name/date/amount/ref, masked mode + checklist | Manual 2-step recovery, prevents bypass |
| Settings | Bank details JSON, fulfilment days JSON, pickup note, global fee | All V1 tunables in UI |

## 6. Non-Functional

| Domain | Recommendation | Reason |
|---|---|---|
| Mobile | 360px-first, Tailwind responsive, compressed images, minimal JS | Primary access via phones, low data |
| Reliability | Postgres transactions + CHECK (available>=0), daily Supabase backups | Orders/stock/IDs/stockpile must not lose |
| Security | RLS, signed proof URLs, no ID enumeration, rate-limit lookup, admin-only writes | Protect customer/payment/Order IDs |
| Accuracy | NGN ints, server-side totals + fee recompute, snapshot prices | Stock/payment/fee/status correct |
| Maintainability | Admin UI for products/prices/variants/stock/fees/bank/days, README runbook | No code edit for daily ops |
| Simplicity | No design system bloat, single font, 2 roles only | Usable without technical knowledge |

## 7. Build Phases

| Domain | Recommendation | Reason |
|---|---|---|
| Phase 0 Setup | Init Next.js+Tailwind+PWA in `Lakky-variety-store-project`, Supabase project + buckets + RLS skeleton, Vercel preview, lock 12 open rules | Clean main + runnable shell before features |
| Phase 1 Domain+DB | Migrations + RLS + seeds (Handbag variants, Gift box, dummy bank/fee/days), unit tests fees/totals/reserve | Proves hardest logic first |
| Phase 2 Storefront | Catalogue → product → cart → checkout → pay → orders tracking | Customer value slice, maps §38 Catalogue/Cart/Payment |
| Phase 3 Admin | Login → queue → order detail verify → products/variants/stock → fees → fulfil → credit → search → settings | Owner can operate store end-to-end |
| Phase 4 Hardening | Notifications list, cancel→credit flow, validation, security, image perf, 360px QA | Production readiness, explicitly exclude §39 extras |
| Phase 5 UAT & Release | §38 checklist scripts + time-travel fee test (Sept1 vs Sept10) + race test + 10-product pilot + backup + handover doc | Acceptance + successful handover |

## 8. V1 Exclusions (Do Not Build)

| Domain | Recommendation | Reason |
|---|---|---|
| Delivery | Record choice only, manual fee note “Handled separately” | Per §13, auto calc is future |
| Verification | Manual admin only, OCR assist display only | Per §14, auto AI is future + risk |
| Roles | Single `is_admin` flag, no staff permissions | Per §39, multi-role is future |
| Growth | No loyalty, analytics, promos, recommendations, segmentation, rider/urgent flow | Per §39, avoid creep, test core first |
| Catalogue extras | Basic mixed grid only, defer search/filter/categories/New/Restocked auto-notify | Per §7, must not block basic catalogue |
| Money out | No cash withdrawal, no auto refunds; large overpayments + seller errors = manual review | Preserves Store Credit policy |

## 9. Open Decisions (Blocking Phase 0)

| Domain | Recommendation | Reason |
|---|---|---|
| Pending stock | First-verified-wins, no hold (proposed) | Simplest, needs approval vs temporary hold |
| Underpayment | One top-up linked, expire X days (propose 7) | Prevents stale pendings |
| Overpayment | Auto-credit, manual review > threshold (propose 50k NGN) | Balances UX vs risk |
| Fee base | Per-Order flat (propose 500 NGN/day) + freezer override (propose 2000) | Needs your Naira values |
| Fee payment | Transfer + proof linked to same Order ID, credit usable? (propose YES) | Keeps single ledger per Order |
| Cancel | Admin-only approve before Completed, accrued fee due unless waived | Clear window + money rule |
| Checkout fields | Pickup: name/phone/day; Delivery: +area/address/landmark/instructions | Minimal V1, expand later |
| Order ID | `LVS-0219` from 219, Pending `P-2026-0001` | Matches examples, distinct namespaces |
| Recovery | ≥4/6 fields match to disclose | Defines “sufficient” objectively |
| Add-ons | No stock in V1 | Unless you sell limited gift boxes |

> Approve table rows or edit values — then lock and start Phase 0.
