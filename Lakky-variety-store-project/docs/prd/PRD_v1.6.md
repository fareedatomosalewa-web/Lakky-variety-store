# PRD v1.6 — Group B verification against real code — direct lib imports
# Version: 1.6 | Date: 2026-10-04 | Base: v1.5 (adds canConfirm gate + real tests)
# v1.0–v1.5 never overwritten. No push yet.

## Scope (Group B: reports + the rest)
5. New Order ID LVS-serial-last4 + parse + last4 search — REAL asserts on lib/domain.ts + lib/harden.ts ✅
6. Abandon flag (60d, never automatic) — REAL asserts on isAbandoned ✅
7. Agree checkbox + agreed_at — wiring asserts (checkout stores agreed_at) ✅
8. WhatsApp wa.me button — REAL asserts on waUpdateLink (wa.me link, no API) ✅
9. Track rate-limit 5/hour/IP — REAL asserts on trackAllowedByIP (5 pass, 6th blocked) ✅
10. Reports page + CSV — wiring asserts (lib/reports.ts + admin page export) ✅
11. Retention (no deletes) + daily backup (BACKUP_DIR env) — wiring asserts ✅

## Code changes in v1.6 (minimal, behavior-identical)
- lib/domain.ts: added canConfirm({seenBank, paid, expected}) gate (same rules/messages as Admin UI)
- app/admin/orders/[id]/page.tsx: Confirm guard now calls canConfirm (same blocks, same messages)
- phase5-real-check.mjs: NEW — imports REAL lib/domain.ts + lib/harden.ts (Node 24 type-stripping), 21 asserts, no copies

## Verification
- Real-code tests: 10/10 Group A + 11/11 Group B PASS
- Full suite: Supabase ✅ phase0 ✅ phase1 ✅ phase4 ✅ phase5 ✅ phase5-add 32/32 ✅ strip 10/10 ✅. 0 FAIL.
