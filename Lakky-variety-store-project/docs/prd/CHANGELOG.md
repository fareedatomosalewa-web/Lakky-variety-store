# CHANGELOG — PRD versions — DO NOT DELETE OLD VERSIONS
# Future changes → new file PRD_v1.3.md + new tag. Never overwrite old files.

v1.0 → original AI draft. Open questions unanswered.
v1.1 → added: money rule, race-loss→credit, under-expired→credit, abandon rule (60d), agree checkbox, seen-in-bank checklist, WhatsApp button, track rate-limit, backup plan. Added proposed answers to open questions.
v1.2 → changed: Order ID LVS-001 → LVS-{serial}-{last4 phone}. Track lookup → full phone. Added: last4 search, Reports page + CSV, retention (keep forever), checkout fields decided. Bank details, fulfilment days, pickup note → editable in admin Settings only (never in code/PRD). Moved: visitor counts → LATER. Backup LOCATION → deferred to v1.3. Closed Order ID question.
v1.3 → slim top strip on / only (no landing page). / stays grid. Strip: how-it-works 3 steps + track link + WhatsApp from Settings + hold/fee/note from Settings, no hardcode. No rule/logic/table changes.
v1.4 → Supabase pilot DB (Ireland pooler :6543). Fresh seed (no local copy). R2 kept. Local fallback kept. Secrets in .env.local only, never pushed.
v1.5 → Group A money-safety verification (no code change): race-loss→credit, under-expired→credit, seen-in-bank, money rule. All checks PASS.
v1.6 → Group B verification against real code: direct imports of lib/domain.ts + lib/harden.ts (21 asserts, no copies). Added canConfirm gate (same UI rules). All checks PASS.
v1.7 → deadline slice: Settings + checkout pending + Confirm transaction + track, all Supabase-backed (docs/STATUS.md marks the DEMO remainder). E2E PASS, all suites PASS.
v1.8 → step 1 done: v1.7 slice + REAL admin login live in UI (demo flag 0 refs), dev :3001 serves 200s, tsc clean, all suites PASS.
v1.9 → UI cleanup only: strip hides unset values (admin-only to-do), quiet Add to Cart + badge, alert list documented. All checks PASS.
v1.10 → wording + pay flow: inline options, plain-English checkout/pay, receipts in private Storage, /terms, refund plan only. E2E + all suites PASS.
v1.11 → brand redesign: plum/cream tokens, DM Sans, nav + search + categories + featured/new/wholesale/footer, 8-product catalogue. Logic unchanged. All checks PASS.
