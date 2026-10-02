# Handover / Operating Guide — Lakky Variety Store V1 (free, local)

## Daily run (on store device)
1. Start Postgres (once installed) + `npm start` (or `docker compose up -d` when Docker ready). Keep device + internet on.
2. Open `http://localhost:3000` (or Tunnel URL) for shop, `/admin` for owner.

## Owner tasks (no code)
- Add product: Admin → Products → New → name, price, status, images → add variants (colour/size/price/available) → Save.
- Restock: edit variant `available`. Never edit `reserved` manually — it moves only on Confirm/Cancel.
- Verify payment: Admin queue → open Pending → compare Expected vs Submitted + proof → Confirm / Under / Over / Reject. Confirm generates LVS-001… and reserves.
- Underpayment: tell customer outstanding; top-up links to same Pending Ref until expiry days (Settings).
- Overpayment: excess auto-credits unless over threshold (Settings) → manual review.
- Stockpile/fees: each Order ID shows confirm date, free-until, extra days, fee. Release blocked if fee unpaid. Fee payment verified per Order ID.
- Cancel: customer requests → Admin approves → paid → Store Credit (non-cashable), stock returns.
- Recovery: search by date/amount/ref/phone → masked list → require secondary match (name/phone/products) before disclosing ID.
- Settings: bank, fulfilment days, global fee, free days, thresholds — all editable, no rebuild.

## Backups (free)
- DB: `pg_dump lakky_store > backup.sql` nightly → copy to R2 `backups/` + USB.
- Uploads: `./uploads` folder copied alongside.

## Costs: ₦0 — Node, Postgres, Better Auth, R2 free tier, Tunnel free. No Supabase/Vercel.
