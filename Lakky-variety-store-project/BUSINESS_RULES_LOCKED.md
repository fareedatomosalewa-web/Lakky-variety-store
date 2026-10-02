# Lakky Variety Store — Business Rules Locked (V1)

Source: PRD V1 + Google Docs reviewed plan. PRD numbers are defaults, editable in Admin Settings.

- Auth: admin email+password only (Better Auth). Customers: no accounts, no OTP. Phone = contact/matching ID.
- Tracking: requires Order ID + matching phone. Phone alone cannot retrieve.
- Order IDs: sequential from LVS-001, never merged, never reused.
- Pending Ref: P-YYYY-0001, never fulfilable, never reserves stock. Top-ups stay linked until verified/expired/rejected.
- Confirm is atomic: insert order from pending snapshot, available-=qty, reserved+=qty, notify. Abort on insufficient stock.
- Underpayment: no ID, show outstanding, expiry editable in Settings.
- Overpayment: confirm + reserve, excess to credit unless over editable threshold.
- Retaining fee: free_until = confirmed_date (Africa/Lagos) + 14 days 23:59 (default, editable). fee = extra_days * rate. Default 500 NGN/day, bulky e.g. freezer 2000 NGN/day (examples only).
- Release blocked if fee unpaid. Fee keeps accruing.
- Cancellation: customer requests, admin approves only. Paid converts to Store Credit (non-cashable V1). Stock returns. Accrued fee due unless waived.
- Store Credit: ledger with +/- , reason, admin actor, related Order ID. Non-cashable.
- Checkout: show Expected Transfer, require customer confirm before proof submit.
- Payment history: original + top-ups + fee payments + timestamps + admin actions.
- All numeric rules editable in Admin Business Rules / Settings. No hard-code.
- Single admin. No customer roles. No loyalty/analytics/promos in V1.
