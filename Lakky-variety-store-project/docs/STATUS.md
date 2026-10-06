# STATUS — what is REAL vs DEMO (v1.7, deadline slice)
# Updated: 2026-10-04. Rule until v1.11 PASS: no real orders, no real bank details, no customer link.

## REAL (Supabase, proven by scripts/v17-e2e.cjs)
- Settings read/write (bank, days, note, fees) — lib/shop-actions.ts getSettings/saveSettings
- Checkout creates pending_refs + pending_items + customers — createPending
- Pay receipt upload to private bucket payment-proofs + agreed_at — submitReceipt
- Admin Confirm in one transaction (order + order_items + available-=qty/reserved+=qty, Seen-in-bank gate) — confirmOrder
- Admin sees signed receipt image + verified box — getSubmissionProof
- Track by Order ID + full phone with fee math — trackOrder
- /terms with live numbers; plain-English customer pages
- Admin login UI (Better Auth session + role gate, demo flag 0 refs) — v1.8; needs owner account via create-owner
- RLS lockdown 22/22 tables, public refused (42501) — drizzle/rls-lockdown.sql

## DEMO (localStorage / placeholders — do NOT rely on)
- Proof upload file picker (decorative; submission row IS saved) → v1.9
- Reports page data (demo zeros; math lib correct) → v1.10
- Backup schedule + off-machine copy (script only) → v1.11
