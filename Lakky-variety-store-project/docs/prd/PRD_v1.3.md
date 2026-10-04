# PRD v1.3 (candidate) — slim top strip only — BUILD FROM v1.2 + THIS DELTA
# Version: 1.3 | Date: 2026-10-04 | Base: v1.2 ACTIVE (unchanged)
# Rules: NO change to business rules, checkout logic, Order ID, fees, admin. No new tables. v1.0–v1.2 never overwritten.

## Delta vs v1.2
- `/` stays product grid. Add slim top strip above grid, 360px-first.
- Strip contents:
  1. How it works: 1 Choose → 2 Pay by transfer → 3 Upload proof, we confirm
  2. Trust line from Settings live: Free {freeHoldDays}-day hold • Fee ₦{globalDailyFee}/day after • {pickupNote}
  3. Links: Track your order → /orders • WhatsApp us → wa.me/{number from Settings}
- WhatsApp number: optional `whatsapp` key in Settings, else bank contact phone; if missing, button hidden + note "WhatsApp number set in Admin Settings". Never hardcoded.
- No hero, no extra pages, no sign-up, no new DB tables. Checkout / Order ID / fees / admin untouched.

## Files
- `app/page.tsx` (strip + grid), `app/globals.css` (.strip), `phase53-strip-check.cjs` (10 asserts)

## Acceptance
- ALL old checks still PASS. Strip checks PASS. See phase53-strip-check.cjs output.
