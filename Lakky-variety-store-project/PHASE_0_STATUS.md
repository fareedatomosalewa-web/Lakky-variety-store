# Phase 0 — Status

## Done (files only, not yet runnable — Node/Docker missing on device)
- package.json (Next 14 + Better Auth + Drizzle + R2 SDK)
- docker-compose.yml (local Postgres 16 + app)
- Dockerfile (Node 20 standalone)
- next.config.mjs
- lib/domain.ts (fee, totals, payment diff, LVS-001 formatter — pure, unit-testable)
- .env.example (DATABASE_URL, BETTER_AUTH_SECRET, R2 keys, Africa/Lagos)
- BUSINESS_RULES_LOCKED.md (LVS-001, no customer accounts, configurable numbers)

## Blocked: tooling not installed
`node`, `npm`, `docker`, `psql` not found. Winget is available.

## To finish Phase 0, run on your device (Admin PowerShell):
winget install OpenJS.NodeJS.LTS --accept-source-agreements
winget install Docker.DockerDesktop --accept-source-agreements
# Reopen terminal, then:
# cd "C:\Users\lakky\Documents\Default Project\Lakky-variety-store-project"
# cp .env.example .env.local  (fill R2 + secrets)
# docker compose up -d db
# npm install
# npm run dev  -> http://localhost:3000

Then tell me "tooling ready" and I will verify `npm run dev` + `docker compose ps` and close Phase 0, then start Phase 1 (Drizzle schema + Better Auth + R2 buckets).
