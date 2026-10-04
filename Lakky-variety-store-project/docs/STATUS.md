# STATUS — what is REAL vs DEMO (v1.7, deadline slice)
# Updated: 2026-10-04. Rule until v1.11 PASS: no real orders, no real bank details, no customer link.

## REAL (Supabase, proven by scripts/v17-e2e.cjs)
- Settings read/write (bank, days, note, fees) — lib/shop-actions.ts getSettings/saveSettings
- Checkout creates pending_refs + pending_items + customers — createPending
- Pay records payment_submissions — recordPayment
- Admin Confirm in one transaction (order + order_items + available-=qty/reserved+=qty, Seen-in-bank gate) — confirmOrder
- Track by Order ID + full phone with fee math — trackOrder
- RLS lockdown 22/22 tables, public refused (42501) — drizzle/rls-lockdown.sql
- Auth tables + RLS-proof + login-e2e scripts exist and pass (login UI not yet switched on)

## DEMO (localStorage / placeholders — do NOT rely on)
- Admin login UI (demo flag; real Better Auth objects exist but unwired) → v1.8
- Proof upload file picker (decorative; submission row IS saved) → v1.9
- Reports page data (demo zeros; math lib correct) → v1.10
- Backup schedule + off-machine copy (script only) → v1.11
