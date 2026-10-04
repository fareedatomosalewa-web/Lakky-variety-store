# PRD v1.5 — Group A money-safety verification — NO CODE CHANGE (already built in v1.2)
# Version: 1.5 | Date: 2026-10-04 | Base: v1.4 (code unchanged)
# v1.0–v1.4 never overwritten. No push yet.

## Scope (Group A only)
1. Race-loss → auto Store Credit (`raceLossToCredit` in lib/domain.ts:52) — verified present
2. Under expired/rejected → auto Store Credit (`underExpiredToCredit` in lib/domain.ts:57) — verified present
3. Seen-in-bank checklist, required before Confirm (app/admin/orders/[id]/page.tsx:5,13,31) — verified present
4. Money rule (`moneyRuleBalanced` in lib/domain.ts:65) — verified present

## Verification
- Code grep: all 4 items present at the lines above. No edits needed.
- ALL checks re-ran: Supabase ✅, phase0 ✅, phase1 ✅, phase4 ✅, phase5 ✅, phase5-add 32/32 ✅, strip 10/10 ✅. 0 FAIL.
