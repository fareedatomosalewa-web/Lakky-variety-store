# PRD v1.14 — owner Part 1 fixes (IDs, accounts, catalogue, confirm)
# Version: 1.14 | Date: 2026-10-11 | Base: v1.13
# Owner decisions override older PRDs on conflicts. v1.0–v1.13 never overwritten. No push yet.

## Done
1. IDs: customers see only Order ID (LVS-serial-last4) + Reference ID (REF-XXXXXX). P-YYYY-NNNN
   stays internal (DB + old links); pay route + confirmation + admin links use REF codes.
2. Account first: guests see photos + prices only (no Add, cart gated, checkout redirects to
   login); server refuses guest orders (login-required); sessions verified per order.
3. Demo catalogue removed from shop (8 seed products deleted; 12 owner products remain).
   Handbag row stays in Supabase ONLY because 21 test item-rows point at it — hidden from shop,
   deleted with the test pendings on owner approval. e2e now uses owner products + temp accounts.
4. How-it-works block removed from customer home (Track link stays; admin to-do stays).
5. Admin order loads from Supabase first; missing ref shows admin wording (no customer text).
6. Admin Confirm = one “I have seen the payment” checkbox + Confirm (submitted amount used).

## Verification
- tsc clean, /, /signup, /discounts, /wishlist, /about 200, ALL suites PASS, 0 FAIL.
