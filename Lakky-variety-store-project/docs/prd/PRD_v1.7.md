# PRD v1.7 — Supabase shop slice (deadline build)
# Version: 1.7 | Date: 2026-10-04 | Base: v1.6
# Scope (ONLY): Settings + checkout pending + Confirm transaction + track — all Supabase-backed.
# Skipped as DEMO (see docs/STATUS.md): real admin login UI, proof upload bytes, reports data, backup schedule.
# v1.0–v1.6 never overwritten. No push yet. Secrets only in local .env.local.

## Built
1. Settings in Supabase — getSettings/saveSettings, page shows source + local fallback.
2. Checkout creates pending_refs (+items, +customers upsert, P-YYYY-NNNN via sequence) with local-ref fallback.
3. Confirm in ONE db transaction: Seen-in-bank gate → underpayment branch → serial=nextval(order_serial_seq) → LVS-serial-last4 → order + order_items → guarded stock move (aborts + rolls back on race) → pending=confirmed.
4. Track reads Supabase (ID + FULL phone, phone-alone fails) with fee math from live Settings rate.

## Proof
- scripts/v17-e2e.cjs drives the REAL actions: pending P-2026-0001 → payment → order LVS-001-1234 → stock moved → track hit → wrong-phone miss → cleanup + stock restored. ALL PASS.
- Table Editor path: Supabase dashboard → project (Ireland) → Table Editor → orders (row display_id LVS-…), order_items, pending_refs (status confirmed), variant_skus (available-/reserved+).
- Regression: tsc clean + ALL old suites (phase0/1/4/5/5-add/strip/real/auth-e2e/rls) PASS, 0 FAIL.
