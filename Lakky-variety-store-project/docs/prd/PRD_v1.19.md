# PRD v1.19 — owner screenshot fixes 1–10
# Version: 1.19 | Date: 2026-10-12 | Base: v1.18
# v1.0–v1.18 never overwritten. No push yet.

## Done
1. Pickup day: next-7-days list (Today + weekday + date, Africa/Lagos), shortcuts removed,
   chosen ISO date saved on the order.
2. Admin products: photo/name/price/stock rows; tap opens editor (photos remove, details,
   delete with “Are you sure?”).
3. Reports: plain-English numbers on top + readable order list; CSV kept.
4. Admin separate: no customer nav/cart on admin paths; admin tabs Orders/Products/Reports/
   Settings; customer pages send signed-in owners to Orders.
5. Netlify badge: zero badge code in repo — injected by hosting/browser (verify Incognito first).
6. Orders table: stacked rows with labels under 640px, no sideways scroll.
7. Duplicates: idempotency key (double-tap/retry returns same pending); disabled button;
   receipt attaches to same order; drafts hidden from admin until receipt; unpaid auto-expire
   minutes in Settings. Existing 3 duplicates: AWAITING owner OK (not deleted).
8. Bulk: tick → Confirm/Reject with “Confirm N orders?” step + per-order results.
9. IDs: 4-digit Reference (digits 2–9, unique-checked); Order ID only after confirm;
   track takes either + phone.
10. Coupons: box kept, owner-only creation, clear message on bad codes.

## Verification
- tsc clean, dev 200s, ALL suites PASS, 0 FAIL.
