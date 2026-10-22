# Supabase setup

1. Create a Supabase project and copy its project URL and publishable key into `.env.local`, using `.env.example` as a template.
2. Run `migrations/202609290001_initial_schema.sql` in the Supabase SQL Editor.
3. Run `migrations/202610020001_organizer_applications.sql` in the Supabase SQL Editor to enable organizer applications and admin review.
4. Run `migrations/202610020002_immediate_signup.sql` in the Supabase SQL Editor so organizer applications are created at sign-up without waiting for email confirmation.
5. Run `migrations/202610020003_organizer_team_atomic_scanner.sql` in the Supabase SQL Editor for team access, QR scanning, and scan audit logs.
6. Run `migrations/202610080001_wallet_credits.sql` in the Supabase SQL Editor to enable Lomé Events credits.
7. Run `migrations/202610140001_events_and_checkout.sql` in the Supabase SQL Editor for organizer event publishing, public catalog, CinetPay orders, and paid ticket fulfillment.
8. Run `migrations/202610150001_wallet_payment_checkout.sql` in the Supabase SQL Editor to enable wallet credit payments at checkout.
9. In Authentication > Sign In / Providers > Email, turn off **Confirm email** and save. Supabase controls this setting; it cannot be changed from the application.
10. Create an account through `/connexion`.
11. In the SQL Editor, promote the first administrator by replacing the email below with the account email:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@example.com'
);
```

At sign-up, users choose participant or organizer. Organizer sign-up collects personal details followed by organization details; the database creates a pending application immediately. The account remains a participant while pending. Admins review requests in `/admin`; approval grants the `organizer` role and sends an in-app notification, while rejection requires a reason and notifies the applicant. The organizer dashboard is only shown after approval. The sign-up assistant performs format and completeness checks in the browser; it does not verify identity or organization documents.

Approved organizers manage their team in the organizer dashboard. A teammate first creates their own account; the organizer then adds the email already attached to that Supabase account. Team membership never changes the member's participant role. This avoids letting someone claim another person's email when email confirmation is disabled. Scanners use `/scanner` with their own login; ticket validation is a database RPC that atomically claims an unused ticket, requires a paid order and matching event, and records each attempt in `ticket_scan_logs`. This MVP requires a live connection; it never accepts an offline scan.

Team roles are `manager` (all scanner permissions), `scanner` (check-in only), `cashier` (sales permission), and `staff` (explicit scan/sales/stats permissions). Team owners can activate, disable, reactivate, or remove members. To verify concurrency after real paid tickets are present, open the same event on two authorized scanner devices and scan the same ticket at nearly the same time: exactly one should return `valid`, and the other `already_used`. The SQL migration cannot be applied or concurrency-tested by the local app build; execute it in the Supabase SQL Editor first.

The role promotion must only be run by a trusted project owner in the SQL Editor. Never expose a `service_role` key in browser code or `NEXT_PUBLIC_` variables. Orders, tickets, and payments intentionally have no client-side write policies; checkout and payment fulfillment use authenticated database RPCs and a trusted server callback.

## Events and checkout

Approved organizers can save event drafts or submit events for admin review. Submitted events are not public until an administrator publishes them. The current event form uses the venue text for both venue and address; add separate address entry, poster upload, and precise map location before launch if needed.

The home page, search, event detail, and checkout catalog read published events from Supabase. Apply the migration above before using event publication.

Set `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_APP_URL` in the server/deployment environment. Never expose the service-role key or CinetPay API key through a `NEXT_PUBLIC_` variable. Configure CinetPay's notification URL as `/api/payments/cinetpay/notify` and use the production HTTPS domain for the app URL. The application creates pending orders server-side and issues tickets only after verifying payment status with CinetPay. Merchant credentials and a full CinetPay sandbox/live test are required before accepting real payments.

## Lomé Events credits

The `/portefeuille` page reads the authenticated user's append-only `wallet_transactions` ledger; the displayed balance is the sum of its credit entries minus any payment debits. Users and admins can read movements, but client-side inserts, updates, and deletes are denied. Admins grant refunds, promotions, or compensation from the `Crédits Lomé Events` section in `/admin`; the database RPC verifies the admin role, validates amount and reason, resolves the recipient account by email, and writes an auditable movement with a request ID.

Users can also use their Lomé Events credit balance directly at checkout to purchase tickets atomically via `pay_order_with_wallet`. Credits cannot be recharged or transferred yet.