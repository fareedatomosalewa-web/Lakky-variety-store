# PRD v1.7 — real admin login + RLS lockdown — honest status below
# Version: 1.7 | Date: 2026-10-04 | Base: v1.6
# v1.0–v1.6 never overwritten. No push yet.

## Honest build status (v1.7)
- DONE-REAL: repo/PRDs/tags, Supabase schema + seeds, secret hygiene (.env.local blocked, recovery key terminal-only), v1.3 strip UI, v1.7 admin login (Better Auth email+password, role=admin gate on all 5 admin pages, demo flag deleted), RLS on 22/22 tables with locked-role proof.
- DONE-DEMO: orders/payments/credit/fees/stock (browser localStorage → v1.8), proof upload picker (decorative → v1.9), reports data (zeros → v1.10), backups (script only → v1.11).

## v1.7 changes
- lib/db.ts NEW (server-only pooled connection), lib/auth-options.ts NEW (shared config),
  lib/auth.ts rewired (real adapter + getAdminSession), app/api/auth/[...all]/route.ts NEW,
  lib/auth-client.ts + lib/admin-guard.ts + lib/use-admin-guard.ts NEW,
  app/admin/login rewritten, all 5 admin pages guarded, demo flag deleted (0 references),
  db/schema.ts auth tables in Better Auth shape (+admin_meta for recovery hash),
  drizzle/rls-lockdown.sql + scripts/apply-rls.cjs + scripts/rls-check.cjs NEW,
  scripts/create-owner.cjs NEW (refuses placeholders/duplicates, recovery key once),
  scripts/auth-e2e.cjs NEW (self-cleaning: wrong rejected, temp owner round-trip, cleanup).
- Owner setup (owner does it): fill ADMIN_EMAIL + strong ADMIN_PASSWORD + BETTER_AUTH_SECRET
  in .env.local → run create-owner → save printed recovery key → sign in at /admin/login.
- R2 keys untouched until v1.9. No real orders/bank/link until v1.11 PASS (owner rule).

## Verification
- Login e2e 5/5 PASS, RLS proof PASS (22/22 locked, 42501 refusal), full old suite PASS, 0 FAIL.
