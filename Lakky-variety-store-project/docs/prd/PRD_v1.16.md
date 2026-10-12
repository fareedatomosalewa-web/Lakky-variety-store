# PRD v1.16 — pre-demo fix list (security + admin truth + tracking + hardening)
# Version: 1.16 | Date: 2026-10-11 | Base: v1.14
# v1.0–v1.14 never overwritten. No push yet.

## Done
1. Admin session gate on every mutating/sensitive server function (34; staff roles enforced).
2. Admin queue + order detail read Supabase first; Under/Reject persist with notify; no fake
   local confirm — explicit error + nothing changed.
3. Tracking accepts pending REF + phone with live stages (checking/underpaid/rejected/
   confirmed); localStorage fallback removed.
4. Hardening: loud checkout/receipt failures (no silent fake refs); server-recalculated totals
   (browser prices display-only); admin sign-up closed (disableSignUp, scripts unaffected);
   keyed lookups replace 500/5000-row scans.
- Data repair: variant attrs were double-encoded scalars (stock matched by price fallback) —
  repaired 23 rows to real objects; seed/sync scripts pass objects now.

## Verification
- tsc clean, dev 200s, ALL suites (phase0/1/4/5/5-add/strip/v1/real/login/rls/supabase/sec/v17-e2e) PASS, 0 FAIL.
