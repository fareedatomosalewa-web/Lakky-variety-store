# IMPLEMENTATION PLAN — Lakky Variety Store App V1

> Source: PRD V1 (42 sections) + Google Docs Real Implementation Plan V1 (owner-edited).
> Status: Planning only, no build yet. All numbers are defaults/examples unless edited in Admin Settings.

## 1. Architecture and Stack

| Domain | Recommendation | Reason / Details |
|---|---|---|
| App Type | Single PWA web app, not native | Mobile-friendly, no Play Store delay, low data use, one codebase for shop plus admin |
| Frontend | Next.js App Router plus Tailwind CSS | SEO for catalogue, route groups for shop and admin, PWA-ready, fast iteration |
| Backend / Database | Supabase Postgres with Row Level Security | Transactions for reserve and release, isolates customer vs admin data, free-tier friendly |
| Auth | Supabase Auth for admin login using email + password | Single admin for V1 using email + password. Customers do not create accounts in V1. Phone number is collected at checkout as customer contact / order-matching identifier, not authentication. No OTP in V1. Order tracking requires both Order ID and matching phone number |
| Storage | product-images public, payment-proofs private with signed URLs | Fast product images, secure proofs for admin plus owner only |
| Hosting | Vercel for app, Supabase for DB and storage and cron | Preview deploys, zero DevOps, scales for V1 |
| Mobile | PWA manifest, installable, 360px first | Owner and customers primarily on smartphones |
| Rejected | Flutter / Firebase, WordPress / Woo | Native overhead, or hacky stockpile and fee and never-merge logic |

## 2. Data and Domain Model

| Domain | Recommendation | Reason / Details |
|---|---|---|
| Product | products table with name, description, base price NGN, status, fee override | Base listing, tags New Restocked OutOfStock Unavailable, bulky override |
| Images | product-images table with URL and sort order, max 5MB compressed | Multiple ordered images |
| Variants | variant-skus with attrs JSON, price, available, reserved, unique per product plus attrs | Stock belongs to combination e.g. Black plus 9 inch, zero stock equals disabled |
| Add-ons | addons table, no stock in V1 e.g. Gift box 2000 | Adds to total, avoids complexity |
| Customers | customers with full name, phone unique normalized to +234, credit balance | Phone is the V1 customer/contact and order-matching identifier, not authentication |
| Pending Orders | Pending Ref P-2026-0001 plus items plus payment submission | Pre-verification container, never fulfilable; does not reserve stock. All payment attempts / top-ups remain linked until fully verified or expired / rejected |
| Confirmed Orders | Sequential Order ID starting from LVS-001, then LVS-002, LVS-003, and so on. Include totals, payment and fulfilment status, confirmed at, and free until | Unique never-merge ID, full order record with price snapshot. Order IDs are sequential for easy tracking and reference. The sequence starts at 001 for the first confirmed order. Each order gets its own permanent ID and is never merged |
| Store Credit | credit ledger with plus/minus amounts, reason, admin actor and related order ID where applicable | Audit trail for overpayment, cancellation, adjustments; store credit is non cashable in V1 |
| Settings | Bank details, global daily fee, overpayment manual review threshold, fulfilment days, pickup note | All V1 tunables editable in UI; overpayment threshold is configurable rather than hard coded |

## 3. Core Business Logic

| Domain | Recommendation | Reason / Details |
|---|---|---|
| Totals | Sum variant price times qty plus addons minus credit, integers in NGN | Auto calc, live cart total, no float errors |
| Confirm | One DB transaction: insert order from pending, decrement available, increment reserved, notify | Atomic Confirm to ID to Reserve, abort on race |
| Underpayment | No Order ID, show outstanding, one top-up linked. Do not confirm or reserve stock until the full required amount is verified. Original payment and all top-ups remain linked to the same pending payment record. The pending-payment expiry period must be editable in Settings | Blocks processing, gives recovery path |
| Overpayment | Confirm plus ID plus reserve, excess to auto credit unless over editable overpayment manual review threshold in settings | Meets policy, handles large cases. Threshold editable from app |
| Retaining Fee | Free until equals confirmed date Africa/Lagos plus 14 days 23:59. Extra days times daily rate. Eg 500 NGN per day, bulky e.g. freezer 2000 | Per Order independent, transparent breakdown. Examples are starting examples only, changeable when policy changes |
| Release Rule | Block Ready and Out for Delivery if fee unpaid, fee keeps accruing | Release follows fee rules set in app |
| Cancellation | Customer requests cancellation, admin approves only, paid converts to credit, stock returns, accrued fee due unless waived | No auto cash refund |
| Recovery | Admin search by date amount ref phone, masked list depending on configured verification before disclose | Manual 2-step, no OTP, no auto reveal |
| Settings / Business Rules | Create Admin Business Rules / Settings area where all numeric V1 rules can be viewed and edited. Includes fees, free-storage period, payment/underpayment expiry, overpayment threshold, other limits | PRD numbers are examples/defaults, not hard-coded. Owner changes from admin app without code |

## 4. Storefront

| Domain | Recommendation | Reason / Details |
|---|---|---|
| Catalogue | Mixed grid, image, name, from-price, status | See availability immediately |
| Product Page | Variant pickers, disable zero stock, addon checkbox, Add stays on page | Correct variant selection before adding to cart |
| Cart | Lines with variant, qty controls, live total, merge same variant | Monitor spending |
| Checkout | Name, phone, pickup or delivery, conditional address fields, credit toggle, show Expected Transfer and require confirm before proof | Complete fulfilment info upfront |
| Pay | Show bank details, upload proof plus amount date time ref | External pay plus proof flow |
| Track Orders | Lookup by phone plus Order ID, timeline, stockpile card with countdown and fee | Traceable bought to collected. Phone alone cannot retrieve order |

## 5. Admin Console

| Domain | Recommendation | Reason / Details |
|---|---|---|
| Dashboard | Queue Pending first with counts and clear status indicators | Focus on verification |
| Order Detail | Full record: customer, lines, fulfilment, expected vs submitted, proof, stockpile and fee | Single source of truth |
| Verify | Confirm, Under, Over, Reject plus verified amount, audited | Manual authority, audit trail, AI assist only |
| Payment history | Keep complete history: original, top-ups, overpayments, fee payments, status, timestamps, admin actions | Easy to see what was paid and what happened |
| Products | CRUD, images, variant price and stock, status tags | Owner manages without code |
| Fees and Credit | Edit global and override fees, verify fee payments, manage credit ledger | Configurable and auditable. No rebuild needed |
| Settings | Bank details, fulfilment days, fees, pickup note | No hard-code |
| Business rules and settings | Admin settings area for all numeric rules: fee amounts, free period, overpayment threshold, underpayment expiry, other limits | PRD figures are defaults, owner can change anytime |

## 6. Phases

| Domain | Recommendation | Reason / Details |
|---|---|---|
| Phase 0 Setup | Init repo, buckets and RLS skeleton, Vercel preview, lock rules | Runnable shell first |
| Phase 1 Data | Migrations, seeds, tests for totals, fees, stock, payment records, IDs, credit, settings | Prove hardest logic |
| Phase 2 Shop | Catalogue, product pages, cart, checkout, payment instructions, proof upload, ID+phone tracking | Complete shopping flow |
| Phase 3 Admin | Pending queue, order details, verification, under/over handling, credit, fee verification, products, settings | Owner operates end to end |
| Phase 4 Harden | Validation, security, notifications, cancel/credit, races, edge cases, mobile, configurable rules | Correct in unusual cases |
| Phase 5 Release | Acceptance checklist, time-travel fee test, payment scenarios, reservation/fee/tracking verify, handover guide | Confirm before opening to customers |

## 7. V1 Exclusions

| Domain | Recommendation | Reason / Details |
|---|---|---|
| Delivery | Record only, fee manual | Auto calc is future |
| Automation | No auto AI verify, no roles, no loyalty, no analytics, no promos | Avoid scope creep |
| Customer accounts | No customer account or OTP login in V1 | Shop without accounts. Phone for contact/matching only |
| Admin roles | No multiple admin roles in V1 | Single admin, more later if needed |
| Loyalty | No loyalty/reward in V1 | Focus on core shopping |
| Analytics | No advanced analytics in V1 | After core works |
| Promotions | No advanced promotions/discount in V1 | Simpler pricing for V1 |
| Catalogue | Basic grid only, defer search/filters/categories | Must not block shop |
| Future features | Do not build outside approved V1 scope | Prevent complexity |

## 8. Decisions Locked from Google Docs Edit

- Auth: admin email+password only; customers no accounts; phone = contact/matching ID; tracking needs Order ID + matching phone.
- Order IDs: sequential from LVS-001; never merged.
- Pending never reserves stock; top-ups linked until verified/expired/rejected.
- Store Credit non-cashable, ledger with related Order ID.
- All numeric rules editable in Admin Settings — PRD numbers are defaults only.
- Checkout shows Expected Transfer + requires confirm.
- Payment history shows original + top-ups + fee payments + timestamps + admin actions.
