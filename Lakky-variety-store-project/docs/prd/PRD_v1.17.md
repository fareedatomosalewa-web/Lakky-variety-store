# PRD v1.17 — owner Part 1 fixes (IDs, accounts, catalogue, confirm) — REVISED
# Version: 1.17 | Date: 2026-10-11 | Base: v1.16
# Owner decisions override older PRDs on conflicts. v1.0–v1.16 never overwritten. No push yet.

## Done (Part 1, all six)
1. IDs: customers see only Order ID (LVS-serial-last4) + Reference ID (REF-XXXXXX). The 3rd code
   (P-YYYY-NNNN) stays as the internal database key only — never displayed, old links still work.
2. Account first: guests see photos + prices; Add/cart/checkout require login (UI + server refuse).
3. Demo catalogue removed from shop (12 owner products only). Handbag row stays in Supabase ONLY
   while test item-rows point at it; e2e now uses owner products + temp accounts.
4. How-it-works block removed (Track link + admin to-do stay).
5. Admin order loads Supabase first; missing ref shows admin wording.
6. Confirm = one “I have seen the payment” checkbox + Confirm (submitted amount used).

## Also in this version
- Server order messages can attach to unconfirmed pendings (pending_id column) — found by proof test.
- e2e cleanup covers notifications/messages/sessions (FK-safe).
- Variant attrs repaired to real JSON objects (were double-encoded strings); seed/sync scripts fixed.
