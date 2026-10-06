# PRD v1.9 — UI cleanup only (no logic, no Supabase, no fees change)
# Version: 1.9 | Date: 2026-10-06 | Base: v1.8
# v1.0–v1.8 never overwritten. No push yet.

## Done
1. Strip: FILL-IN / "enter in Admin Settings" never shown to customers — empty values hide
   the line; logged-in admin sees a to-do note instead. Fee line shows only when set.
2. Strip copy short: steps + Track link (+WhatsApp when a number is set).
3. Add to Cart: alert removed; quiet header badge (new app/cart-badge.tsx) via
   lakky-cart-updated event; button shows "Added ✓" 2s. Unavailable-variant alert kept.
4. Other customer alert()s listed (unchanged): checkout ×3 (name/phone, confirm, agree),
   pay ×1 (submitted), product ×1 (unavailable kept), notifications ×2 (cancel flow),
   admin settings ×1 (saved, owner-only).

## Verification
- tsc clean, / + /p/0 return 200 on :3001, full suite PASS, 0 FAIL.
