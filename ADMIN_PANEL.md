# Admin Panel — Spec & Deliverables

A planning doc for an internal admin panel to manage users, subscriptions,
discount codes, and free-account provisioning for **Garden Calendar**.

> **Status:** Not started. This assumes a subscription/billing system that
> **does not exist yet** — see [§0 Prerequisites](#0-prerequisites-billing-foundation).
> Priorities: **P0 = needed for first paid launch**, **P1 = important**,
> **P2 = later**.
>
> **Decided:** The app is **paid at launch** using **Stripe**. Billing is a
> **launch blocker**, not a post-launch item.

Related docs: `MVP.md`, `PRE_LAUNCH.md`, `TECH_STACK.md`, `DEPLOYMENT.md`.

---

## Scaffold status (what's built so far)

An initial scaffold exists. It works end-to-end for reads/writes against
Supabase, but billing (Stripe) is stubbed with TODOs.

**Built:**
- `supabase/migrations/0002_admin_billing.sql` — `profiles` (role/plan/sub
  state), `discount_codes`, `admin_audit_log`, an auto-create-profile trigger,
  an `is_admin()` helper, and RLS policies.
- `api/_lib/admin.js` — shared `requireAdmin()` (verifies JWT + admin role via
  the **service-role** client), `audit()`, and response helpers.
- `api/admin/users.js` — `GET` searchable/paginated user list.
- `api/admin/grant-access.js` — `POST` grant/revoke comped access (app-side;
  Stripe coupon path TODO).
- `api/admin/discount-codes.js` — `GET`/`POST` list & create codes (Stripe
  coupon mirroring TODO).
- `api/admin/metrics.js` — `GET` dashboard counts (revenue TODO).
- `public/admin.html` — admin UI: sign-in gate, metrics, Users / Discount codes
  / Provision-access tabs. Served at **`/admin`**.
- `package.json` — added `@supabase/supabase-js`.

**Setup required to use it:**
1. Apply the `0002_admin_billing.sql` migration to your Supabase project.
2. Add **`SUPABASE_SERVICE_ROLE_KEY`** to Vercel env (and `.env.local`).
3. Promote your account: in Supabase SQL editor run
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
4. Visit `/admin`, sign in with that account.

**Not yet built (TODO):** all Stripe billing (see `BILLING.md`), user detail
view, subscription actions (cancel/refund/change plan), code deactivate/edit,
CSV export, support tooling, and impersonation.

---

## 0. Prerequisites (billing foundation)

Before an admin panel is meaningful, the app needs a way to charge and track
plans. **Billing = Stripe. The app is paid at launch**, so this section is a
**P0 launch blocker** and should be built before (or alongside) the admin panel.

- [x] **Billing provider chosen** — **Stripe** (Checkout + Billing/Customer
  Portal + webhooks).
- [ ] **Define the plans** — decide the exact tiers + prices. Suggested:
  a single **`pro`** plan with **monthly** and **yearly** prices, and an
  optional **free trial** (e.g. 14 days). Document what `pro` unlocks.
  - [ ] Is there a **free tier** at all, or is the whole app paid (with a
    trial)? *Recommended: free trial → paid, no permanent free tier, since
    the app is "paid at launch."*
- [ ] **Create products & prices in Stripe** (monthly + yearly Price IDs).
- [ ] **Decide trial length + failed-payment grace period** (Stripe dunning).
- [ ] **Stripe → Supabase mapping** — store `stripe_customer_id` and
  subscription state per user in `profiles`.
- [ ] **Checkout flow** — `/api/create-checkout-session` creates a Stripe
  Checkout Session; success/cancel URLs return to the app.
- [ ] **Customer Portal** — `/api/create-portal-session` so users can manage/
  cancel their own subscription (offloads most billing UI).
- [ ] **Webhooks** — `/api/stripe-webhook` (verify signature with
  `STRIPE_WEBHOOK_SECRET`) to keep Supabase in sync with Stripe:
  `checkout.session.completed`, `customer.subscription.created/updated/deleted`,
  `invoice.payment_succeeded`, `invoice.payment_failed`.
- [ ] **Feature gating / paywall** in the app — read the user's plan +
  entitlements and gate the app behind an active subscription or trial.
- [ ] **Test mode first** — build with Stripe test keys + the Stripe CLI to
  forward webhooks locally before going live.

### Suggested data model (Supabase)
```
profiles                      -- 1 row per auth user
  user_id            uuid PK, FK auth.users
  email              text
  role               text default 'user'   -- 'user' | 'admin'
  plan               text default 'free'   -- 'free' | 'pro' | ...
  status             text default 'active' -- 'active' | 'trialing' | 'past_due' | 'canceled'
  stripe_customer_id text
  current_period_end timestamptz
  comp_reason        text                  -- why a free/comped account was granted
  created_at         timestamptz default now()

subscriptions                 -- optional: full history from Stripe
  id                 text PK  -- stripe subscription id
  user_id            uuid FK
  plan               text
  status             text
  current_period_end timestamptz
  cancel_at_period_end bool
  updated_at         timestamptz

discount_codes
  code               text PK
  type               text     -- 'percent' | 'amount' | 'free_period'
  value              numeric  -- 20 (%), 500 (cents), or period length
  duration           text     -- 'once' | 'repeating' | 'forever'
  max_redemptions    int
  redemptions        int default 0
  expires_at         timestamptz
  active             bool default true
  stripe_coupon_id   text     -- if mirrored into Stripe
  created_by         uuid
  created_at         timestamptz default now()

admin_audit_log
  id                 bigint PK
  admin_user_id      uuid
  action             text     -- 'grant_free' | 'create_code' | 'cancel_sub' | ...
  target_user_id     uuid
  detail             jsonb
  created_at         timestamptz default now()
```

---

## 1. Access control & security (P0)

- [ ] **Admin role** — add `role` to `profiles`; gate the panel on `role = 'admin'`.
- [ ] **RLS everywhere** — admin-only tables/policies; regular users can never
  read others' rows. Admin reads go through a **service-role serverless
  endpoint**, never the browser anon key.
- [ ] **Server-side authorization** — every admin API verifies the caller's JWT
  **and** that they are an admin before acting (don't trust the client).
- [ ] **Separate admin route** — e.g. `/admin` (or a subdomain), hidden from
  normal nav; redirect non-admins.
- [ ] **Audit logging** — record every admin action (`admin_audit_log`).
- [ ] **Rate limiting / brute-force protection** on admin endpoints.
- [ ] Consider **2FA** for admin accounts.

---

## 2. Users management (P0)

- [ ] **User list** — searchable/filterable table: email, plan, status, signup
  date, last active, `stripe_customer_id`.
- [ ] **Search** by email / user id.
- [ ] **Filters** — by plan, status (active/trialing/past_due/canceled), comped.
- [ ] **User detail view** — full profile, subscription history, redeemed codes,
  audit trail for that user.
- [ ] **Sort & paginate** (server-side; don't load all users at once).
- [ ] **Export** users to CSV (P1).

---

## 3. Subscription status (P0)

- [ ] **View a user's current plan + status** (source of truth = Stripe,
  mirrored in Supabase via webhooks).
- [ ] **See renewal / period-end date**, trial end, cancel-at-period-end flag.
- [ ] **Payment state** — last payment, failed payments, past_due indicator.
- [ ] **Link out to the Stripe customer** for deep management.
- [ ] **Admin actions:**
  - [ ] **Cancel** a subscription (immediately or at period end).
  - [ ] **Refund** a charge (P1 — or defer to Stripe dashboard).
  - [ ] **Change plan** / move a user between tiers.
  - [ ] **Extend** a period / add comp time.

---

## 4. Free / comped account provisioning (P0)

- [ ] **Grant free access** to a user by email:
  - [ ] Set `plan` (e.g. `pro`) with `status = 'active'` and a `comp_reason`.
  - [ ] Optional **expiry** (comp for N months) vs. **forever**.
  - [ ] Mirror in Stripe as a 100%-off coupon/subscription **or** bypass Stripe
    entirely (decide one approach and document it).
- [ ] **Revoke** comped access (downgrade to free).
- [ ] **Bulk provisioning** (P1) — grant to a list of emails (e.g. beta testers).
- [ ] **Invite flow** (P2) — email an invite that auto-provisions on signup.
- [ ] Every grant/revoke is **audit-logged** with the reason + admin.

---

## 5. Discount codes (P0)

- [ ] **Create a code** — set type (percent / fixed amount / free period),
  value, duration (once / repeating / forever), max redemptions, expiry.
- [ ] **Mirror into Stripe** as a Coupon/Promotion Code (recommended so Checkout
  applies it natively), or handle app-side.
- [ ] **List codes** with redemption counts, status (active/expired/maxed), and
  expiry.
- [ ] **Activate / deactivate** a code.
- [ ] **Edit** (limited — usually only active flag, expiry, max redemptions;
  Stripe coupons are largely immutable).
- [ ] **Delete / archive** a code.
- [ ] **View redemptions** — who used a code and when.
- [ ] **Apply-at-checkout UX** in the app (promo field in Stripe Checkout).

---

## 6. Dashboard / metrics (P1)

- [ ] **Key metrics** — total users, active subscribers, MRR, trials, churn,
  comped accounts.
- [ ] **Recent signups** + recent conversions.
- [ ] **Revenue over time** (or just link to Stripe dashboards).
- [ ] **Code performance** — top discount codes by redemptions.

---

## 7. Support tooling (P1)

- [ ] **Impersonate / "view as user"** (read-only) for debugging (P2, sensitive
  — audit-logged).
- [ ] **Resend** confirmation / password-reset email to a user.
- [ ] **Manually trigger** a data resync for a user.
- [ ] **Delete a user** (GDPR) + purge their `garden_state` row.
- [ ] **Export a user's data** on request.

---

## 8. Tech approach (proposed)

- **Frontend:** a separate `/admin` page (could stay in the single-file style or
  become its own small app). Gate on admin role; redirect otherwise.
- **Backend:** Vercel serverless functions under `/api/admin/*` using the
  **Supabase service-role key** (server-only env var — never shipped to the
  browser). Each verifies the caller is an authenticated admin.
- **Billing:** Stripe Checkout + Customer Portal for user-facing flows; webhooks
  (`/api/stripe-webhook`) sync state into Supabase; admin panel reads Supabase
  and calls Stripe APIs server-side for actions.
- **Secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY` — all server-side only.

---

## 9. Suggested build order

1. **[P0] Billing foundation** — Stripe account, plans, `profiles` table,
   Checkout, webhook → Supabase sync, feature gating.
2. **[P0] Admin auth** — `role` column, `/admin` route, service-role admin API,
   audit log.
3. **[P0] Users list + detail** (read-only first).
4. **[P0] Subscription view + basic actions** (cancel, change plan).
5. **[P0] Free/comped provisioning** (grant/revoke).
6. **[P0] Discount codes** (create/list/deactivate; Stripe coupons).
7. **[P1] Dashboard metrics + CSV export.**
8. **[P1] Support tooling** (resend email, delete user, export data).
9. **[P2] Impersonation, invites, bulk provisioning.**

---

## Decisions & open questions

**Decided:**
- ✅ **Paid at launch.**
- ✅ **Stripe** as the billing provider.

**Still to decide:**
- [ ] **Subscription vs. one-time** — recommended: **subscription** (monthly +
  yearly) to match a seasonal, recurring-use gardening app.
- [ ] **Free trial length** (e.g. 14 days) and whether a card is required up
  front.
- [ ] **Free tier or trial-only?** — recommended: **trial → paid**, no permanent
  free tier (consistent with "paid at launch").
- [ ] **Which features are gated** behind `pro` (likely: cloud sync / multi-
  device, weather, unlimited plants/tasks) vs. available in trial.
- [ ] **Single admin (just you)** or a team? (Affects roles/permissions.)
- [ ] **Comped accounts** — handle **inside Stripe** (100%-off coupon/
  subscription) or **bypass Stripe** with an app-side `plan` override?
  *Recommended: 100%-off Stripe coupon so all state stays in one place.*
- [ ] **Pricing** — the actual monthly / yearly amounts.
