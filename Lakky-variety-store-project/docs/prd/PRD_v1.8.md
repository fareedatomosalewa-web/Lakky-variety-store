# PRD v1.8 — step 1 done: full v1.7 slice + REAL admin login, one tree
# Version: 1.8 | Date: 2026-10-04 | Base: v1.7
# v1.0–v1.7 never overwritten. No push yet.

## Done
- Supabase slice (settings, pending, Confirm transaction, track) + e2e PASS.
- REAL admin login active in UI: Better Auth session + role=admin guard on all 5 admin pages,
  demo flag 0 references, /admin/login + /admin + /checkout return 200 on :3001.
- tsc clean. Full suite (supabase/rls/login-e2e/phase0/1/4/5/5-add/strip/real/v17-e2e) PASS, 0 FAIL.

## Owner action needed (else admin stays locked)
Fill ADMIN_EMAIL + strong ADMIN_PASSWORD + BETTER_AUTH_SECRET in .env.local →
run create-owner → save recovery key → sign in. No real orders/bank/link until v1.11 PASS.
