# PRD v1.10 — customer wording + pay flow + receipts really saved (A–F)
# Version: 1.10 | Date: 2026-10-06 | Base: v1.9
# Order ID format, fee math, stock logic, Confirm logic, Supabase writes: UNCHANGED.
# v1.0–v1.9 never overwritten. No push yet. Service key server-only, never printed/committed.

## Done
- A. Home inline options (Choose options, 0-stock disabled, Added ✓, quiet badge); /p/[id] kept.
- B. Strip: receipt wording; unset values hidden (admin to-do only).
- C. Checkout: name/phone/method/area/day; checkboxes removed (agreement moved to pay).
- D. Pay rewrite: amount, live bank details, ref + Copy, remark note, receipt upload ≤5MB
  compressed, 2 agreement boxes + /terms link, live fee line, gated submit, agreed_at stored,
  zero-total skips receipt, confirmation with ref + Copy + Track.
- E. Receipts in private Supabase Storage bucket payment-proofs (created, public=false);
  key on submission; admin sees signed image + verified box; Seen-in-bank stays.
  Keys: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in local .env.local only.
- F. /terms page, 8 sections, live hold/fee/abandon numbers.
- G refund form: PLAN ONLY (see below), not built.

## Proof
- v17 e2e with REAL receipt bytes: pending → bucket key → signed link → confirm → orders row
  → track hit/miss → cleanup + stock restored. ALL PASS.
- Regression: tsc clean, /, /p/0, /terms, /checkout 200s, ALL old suites PASS, 0 FAIL.

## G plan (refund form — on owner go)
Form (Order ID + phone → credit/refund → bank fields + same-account note) → new refund_requests
table + RLS → admin-only list + name-match tick. Checks: validation + RLS + e2e. v1.11.
