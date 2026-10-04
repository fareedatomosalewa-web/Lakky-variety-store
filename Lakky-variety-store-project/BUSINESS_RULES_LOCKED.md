# Lakky Variety Store — Business Rules Locked (V1.2 ACTIVE)
# Source: PRD.md section 5. ACTIVE. If archive conflicts → this wins.
# Bank details, fulfilment days, pickup note live ONLY in admin Settings DB, seed FILL-IN, never hardcode. Backup location DEFERRED to v1.3.

- Order ID → LVS-{global serial}-{last4 phone}, e.g. LVS-009-9270. serial GLOBAL sequential min 3 digits, never merged/reused. last4 = last 4 digits of checkout phone.
- Pending Ref: P-YYYY-0001, never fulfilable, never reserves stock. Top-ups linked until verified/expired/rejected.
- Confirm is atomic: INSERT orders FROM pending snapshot → available-=qty, reserved+=qty WHERE available>=qty → notify. Abort on insufficient stock → race-loss → full amount to Store Credit auto.
- Underpayment: no ID, no stock move, show outstanding, multiple top-ups until expiry 7 days → Rejected → paid amount → Store Credit auto.
- Overpayment: confirm + reserve, excess → auto-credit unless > ₦50,000 threshold → manual review.
- Retaining fee: free_until = confirmed_date (Africa/Lagos) + 14 days 23:59. fee = extra_days * rate. Default ₦500/day, bulky e.g. freezer ₦2,000/day. Per-Order flat. Examples/defaults editable in Settings.
- Store Credit can pay retaining fees → YES. Ledger +/- with reason, admin actor, related Order ID. Non-cashable V1.
- Release blocked if fee_unpaid > 0. Fee keeps accruing.
- Abandon: fee_unpaid + no contact ≥ 60 days → flag Abandoned → admin decides release/forfeit (never automatic). Lawyer check forfeiture wording before launch.
- Cancellation: customer requests, admin approves only before Completed. Paid → Store Credit. Stock returns. Accrued fee due unless waived.
- Checkout: show Expected Transfer + 14-day hold + daily fee + abandon rule in plain text → required "I agree" checkbox → store agreed_at.
- Verify checklist: admin must tick "Seen in bank" (bank app/SMS, NOT screenshot) before Confirm.
- Tracking: requires Order ID + FULL matching phone. Phone alone retrieves nothing. Rate-limit: 5 wrong tries/hour/IP → lock 1 hr.
- Recovery: search by OrderID/phone/last4/name/date/amount/ref, masked list, require ≥4 of 6 fields match before disclose. No OTP, no auto-reveal.
- Fulfilment: per Order ID only. WhatsApp update button (wa.me prefilled) on every status change, manual send, ₦0.
- Reports: pick date/range → orders placed/approved/rejected/under/over/cancelled, pickup vs delivery, stockpile active, fees due/paid, total ₦ verified, credit issued/used, export CSV. Source = own DB, years later.
- Retention: keep ALL records forever. No deletes, no cleanup jobs.
- Settings editable (no rebuild): bank details, fulfilment days, global fee, free_hold_days, overpayment_threshold, underpayment_expiry_days, abandon_days (60), pickup note.
- Single admin. No customer accounts. No loyalty/analytics/promos/visitor tracking in V1 (visitor counts → LATER).
