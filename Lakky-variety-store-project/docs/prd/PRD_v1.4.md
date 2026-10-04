# PRD v1.4 — Supabase pilot DB — BUILD FROM v1.3 + THIS DELTA
# Version: 1.4 | Date: 2026-10-04 | Base: v1.3 (logic unchanged)
# Rules: fresh pilot DB + seeds, keep R2, no local orders copied. v1.0–v1.3 never overwritten. No push yet.

## Delta vs v1.3
- DATABASE_URL now points to Supabase transaction pooler (Ireland, :6543, prepare:false). Value lives ONLY in local `.env.local` (git-blocked, never printed/committed).
- Schema pushed via `drizzle-kit push` from existing `db/schema.ts` (17 tables present: accounts, addons, credit_ledger, customers, fee_payments, notifications, order_items, orders, payment_submissions, pending_items, pending_refs, product_images, products, sessions, settings, users, variant_skus).
- Fresh seed: 1 product (Handbag), 4 variants, 1 addon (Gift box), 1 settings row (FILL-IN bank, fee 500, hold 14, abandon 60). No local orders copied.
- R2 kept for product-images / payment-proofs in v1.4. Supabase Storage migration deferred.
- Local DB (pg-mem + seeds + backups/local-backup-*) kept as fallback. Rollback = point DATABASE_URL back to local + restart dev.

## Files added (no secrets in any)
- `scripts/supabase-check.cjs` (connectivity, redacted errors)
- `scripts/seed-supabase.cjs` (fresh seed, redacted errors)
- `drizzle/` migration output (if generated)

## Acceptance
- ALL old checks PASS + supabase-check PASS (17 tables, core present). See run output.
