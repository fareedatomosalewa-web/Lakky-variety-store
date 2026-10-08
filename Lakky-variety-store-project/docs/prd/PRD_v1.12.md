# PRD v1.12 — real catalogue (12 Drive products) + Netlify-ready
# Version: 1.12 | Date: 2026-10-06 | Base: v1.11
# Order logic, fees, stock, Confirm, Supabase writes: UNCHANGED.
# v1.0–v1.11 never overwritten.

## Done
- db/seed.ts: Handbag first (unchanged) + 12 sheet products (name, price, comma categories,
  image filename, Drive photo ID, description, color options / single choice, stock 5 default).
- Dynamic category filters (comma-split, new chips appear automatically), search covers
  name + description + category, generic variant pickers (any option dimension, 0-stock off),
  Drive photos with emoji fallback, blank-description fallback line, ₦ everywhere.
- Cart/checkout carry generic attrs (old shape still renders); /p/[id] generic + photo.
- netlify.toml added (build command + publish + env list). Owner deploys from dashboard.
- Notes for owner: Drive file is Face_handerkerchief.jpg vs sheet Face_handerchief.jpg (mapped anyway);
  "whitte" kept as listed; new-product stock defaults 5 — adjust in Admin.

## Verification
- tsc clean, /, /p/8 200 on :3001, ALL suites + v17 e2e PASS, 0 FAIL.
