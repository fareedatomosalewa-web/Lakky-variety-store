# Phase 0 — COMPLETE (100% free tools, automated)

## Stack (no Supabase, no Vercel, no paid)
- Runtime: portable Node v24.19.0 + npm 11.17 (free open-source, no admin, in %LOCALAPPDATA%\lakky-tools)
- App: Next 14 + Better Auth + Drizzle ORM 0.45 + R2 SDK (all free OSS / free tier)
- DB dev: pg-mem (free in-memory Postgres emulator, no install) — reserve/release guard verified
- DB prod-local: PostgreSQL 16 portable/installer — PENDING, see below
- Hosting: local device (Dockerfile + direct `next start`), Cloudflare Tunnel (free) when exposing

## Verified
- phase0-check.cjs: LVS-001 format, Day14 free / Day15 fee, bulky override, under/over diffs — ALL PASSED
- phase0-db-check.cjs: available-=qty/reserved+=qty atomic guard, over-reserve blocked — ALL PASSED
- npm install: 174 + 33 packages, --ignore-scripts (esbuild postinstall needs admin PATH; not needed for runtime)

## One manual step left (physically impossible for me)
Real Postgres 16 on this device needs EITHER:
(a) one admin click: run the winget installer already staged (`winget install PostgreSQL.PostgreSQL.16`), OR
(b) ~30-60 min portable-binary download on this slow link.
Phase 1 schema work proceeds on pg-mem + Drizzle SQL (Postgres-dialect) so no time is lost. `docker-compose.yml` already maps to real Postgres when ready — same SQL runs unchanged.

## Next: Phase 1
Drizzle schema (products, variant_skus, orders LVS-001, pending, ledger, settings), Better Auth admin-only gate, R2 bucket wiring with dev-local fallback to ./uploads.
