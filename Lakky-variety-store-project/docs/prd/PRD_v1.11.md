# PRD v1.11 — Lakky brand redesign (design system = source of truth)
# Version: 1.11 | Date: 2026-10-06 | Base: v1.10
# Logic, Order ID, fees, stock, Confirm, Supabase writes: UNCHANGED.
# v1.0–v1.10 never overwritten. No push yet.

## Done
- Tokens in app/globals.css: Deep Plum #5A2948, Warm Cream #FFF9F3, Terracotta #C97861,
  Charcoal #242124, Taupe #756B68, Green #47745A, Red #B94A48. DM Sans + system fallback.
- Layout: cream sticky header (plum brand + plum Cart), bottom nav Home/Categories/Cart/Orders.
- Home rhythm: hero ("Something for every day." + Shop now) → search → categories (8, one palette)
  → how-it-works strip → featured grid → new arrivals → wholesale callout → footer.
- Product cards: image-first, NEW/Restocked badges, name/price/category, compact inline options.
- Catalogue grown to 8 products across categories (Handbag + variants unchanged).
- Cart: empty state, plum/safe buttons, badge sync. Detail page: same card language.
- Checkout/pay/orders/terms/admin: same tokens, h2 titles, sentence case. Asserted customer
  texts kept; one strip assert updated to approved receipt wording.
- DESIGN_SYSTEM.html left untouched (superseded reference).

## Verification
- tsc clean, /, /cart, /terms 200 on :3001, ALL suites PASS, 0 FAIL.
