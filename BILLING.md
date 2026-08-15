# Billing — Implementation Plan (Stripe)

How Garden Calendar charges for access. **Paid at launch** via **Stripe**
subscriptions.

> **Pricing (placeholder — confirm before launch):**
> - **Pro Monthly — $4.99 / month**
> - **Pro Yearly — $49.99 / year** (~2 months free vs. monthly)
> - **Free trial:** 14 days (placeholder), card required up front.
> - **Model:** subscription; **no permanent free tier** (trial → paid).

Related docs: `ADMIN_PANEL.md` (§0 billing foundation), `MVP.md`,
`DEPLOYMENT.md`, `TECH_STACK.md`.

---

## 1. Plans & entitlements

| Plan | Price | Notes |
|---|---|---|
| **Trial** | $0 for 14 days | Full `pro` access; converts to paid unless canceled. |
| **Pro Monthly** | **$4.99 / mo** | Recurring monthly. |
| **Pro Yearly** | **$49.99 / yr** | Recurring yearly; best value. |
| **Comped** | $0 | Admin-granted (100%-off Stripe coupon). Full `pro` access. |

**What `pro` unlocks (decide/confirm):**
- [ ] Cloud sync / multi-device
- [ ] Weather + frost-date integration
- [ ] Unlimited plants / plantings / tasks
- [ ] (Everything, if the whole app is paid after trial)

> If the whole app is gated behind the trial/subscription, "entitlements" is
> just: **active subscription or trial = full access; otherwise = paywall.**

---

## 2. Stripe setup (dashboard)

- [ ] Create a **Product**: "Garden Calendar Pro".
- [ ] Add two **Prices** on that product:
  - [ ] `price_monthly` — **$4.99** recurring monthly.
  - [ ] `price_yearly` — **$49.99** recurring yearly.
- [ ] Enable a **14-day trial** (set on the Checkout Session or the Price).
- [ ] Turn on the **Customer Portal** (Billing → Customer Portal) so users can
  update card / cancel / switch plans themselves.
- [ ] Configure **dunning** (Billing → automatic retries) for failed payments.
- [ ] Note the **Price IDs** — store as env vars (below).
- [ ] Build in **test mode** first; use the **Stripe CLI** to forward webhooks
  locally (`stripe listen --forward-to localhost:5500/api/stripe-webhook`).

### Environment variables (server-only)
```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only; never shipped to browser
APP_URL=https://<your-domain>        # for success/cancel/return URLs
```
> `STRIPE_PUBLISHABLE_KEY` can be exposed to the browser (via `/api/config`);
> the secret key and service-role key must **never** be.

---

## 3. Data model (Supabase)

Add to / reuse the `profiles` table from `ADMIN_PANEL.md`:

```sql
-- 1 row per auth user; created on first sign-in (trigger) or upsert on demand.
create table if not exists profiles (
  user_id             uuid primary key references auth.users on delete cascade,
  email               text,
  role                text not null default 'user',      -- 'user' | 'admin'
  plan                text not null default 'none',      -- 'none' | 'pro'
  status              text not null default 'inactive',  -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive'
  stripe_customer_id  text,
  stripe_subscription_id text,
  price_id            text,
  current_period_end  timestamptz,
  cancel_at_period_end boolean default false,
  comp_reason         text,                              -- set for admin-comped accounts
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read their own profile (to know their plan). They may NOT write
-- billing fields — only the service role (webhook/admin) can.
create policy "read own profile" on profiles
  for select using (auth.uid() = user_id);
```

> All writes to billing fields happen **server-side** with the service-role key
> (webhook + admin endpoints). The browser only *reads* its own row.

Helper to know if a user has access:
```sql
-- Access = active/trialing subscription that hasn't lapsed, or comped.
-- (Compute in the API/app; shown here as the rule.)
-- hasAccess = status in ('trialing','active')
--             and (current_period_end is null or current_period_end > now())
--          or comp_reason is not null
```

---

## 4. Serverless endpoints (Vercel `/api`)

- [ ] **`POST /api/create-checkout-session`**
  - Auth: verify the caller's Supabase JWT → get user id + email.
  - Find/create a Stripe Customer (store `stripe_customer_id` on `profiles`).
  - Create a Checkout Session:
    - `mode: 'subscription'`
    - `line_items: [{ price: <monthly|yearly>, quantity: 1 }]`
    - `subscription_data: { trial_period_days: 14 }`
    - `success_url`, `cancel_url` → back to the app.
  - Return the session `url`; client redirects to Stripe.

- [ ] **`POST /api/create-portal-session`**
  - Auth: verify JWT → look up `stripe_customer_id`.
  - Create a Billing Portal Session; return `url`.

- [ ] **`POST /api/stripe-webhook`**
  - **Verify signature** with `STRIPE_WEBHOOK_SECRET` (use the raw body).
  - Handle events → upsert `profiles` via the **service-role** client:
    - `checkout.session.completed` → set `stripe_customer_id`,
      `stripe_subscription_id`, `plan='pro'`, `status`, `current_period_end`.
    - `customer.subscription.created` / `updated` → sync `status`, `price_id`,
      `current_period_end`, `cancel_at_period_end`.
    - `customer.subscription.deleted` → `status='canceled'`, `plan='none'`.
    - `invoice.payment_failed` → `status='past_due'`.
    - `invoice.payment_succeeded` → `status='active'`, bump period end.
  - Always return 200 quickly; do work idempotently.

- [ ] **`GET /api/config`** (existing) — extend to also return
  `stripePublishableKey` and the price IDs (public) so the client can render the
  pricing UI.

> **Vercel note:** the webhook route needs the **raw request body** for
> signature verification — disable body parsing for that function.

---

## 5. Client integration (`public/index.html`)

- [ ] **Read plan on load** — after auth, fetch the user's `profiles` row (RLS
  lets them read their own) to determine access.
- [ ] **Paywall / gate** — if no active trial/subscription, show a **pricing
  screen** (reuse the auth-gate overlay style) with Monthly / Yearly options and
  a "Start 14-day free trial" CTA.
  - Monthly button → `create-checkout-session` with the monthly price.
  - Yearly button → same with the yearly price.
- [ ] **Manage billing** — in the Account card, add a **"Manage subscription"**
  button → `create-portal-session` (only when subscribed).
- [ ] **Status display** — show plan + renewal date (and "trial ends in N days").
- [ ] **Return handling** — on `success_url` return, refresh the profile (the
  webhook may lag a second or two; poll/refetch briefly).
- [ ] **Offline-first caveat** — decide how strict the gate is when offline
  (recommended: cache last-known entitlement; allow local use, sync gates when
  back online). The app is localStorage-first, so avoid locking users out of
  their own local data — gate **cloud sync / premium features**, not their data.

---

## 6. Comped / free accounts (admin)

- [ ] Grant via a **100%-off Stripe coupon** applied to a subscription for that
  customer (keeps all state in Stripe), **or** set `plan='pro'` +
  `comp_reason` directly on `profiles` (app-side bypass).
  *Recommended: Stripe coupon so entitlements stay single-sourced.*
- [ ] Revoke → cancel the comped subscription / clear `comp_reason`.
- [ ] Audit-log every grant/revoke (see `ADMIN_PANEL.md` §4).

---

## 7. Testing checklist

- [ ] Test cards: successful subscribe (`4242 4242 4242 4242`), failed payment
  (`4000 0000 0000 0341`), 3DS (`4000 0025 0000 3155`).
- [ ] New user → start trial → profile shows `trialing` + trial end date.
- [ ] Trial converts to `active` after 14 days (or via Stripe clock testing).
- [ ] Monthly and yearly checkout both work; correct price charged.
- [ ] Customer Portal: cancel → `cancel_at_period_end`; access persists until
  period end, then `canceled`.
- [ ] Failed payment → `past_due` → dunning → recovery or cancel.
- [ ] Webhook signature verification rejects forged payloads.
- [ ] Comped account has full access with no charge.
- [ ] Paywall correctly blocks premium features for `inactive`/`canceled`.
- [ ] Switch to **live keys**, re-run a real card end-to-end before launch.

---

## 8. Build order

1. **[P0]** Stripe products + prices ($4.99/mo, $49.99/yr) + trial, in test mode.
2. **[P0]** `profiles` table + RLS + service-role write path.
3. **[P0]** `create-checkout-session` + client pricing screen.
4. **[P0]** `stripe-webhook` → Supabase sync.
5. **[P0]** Paywall gating in the app + status display.
6. **[P0]** `create-portal-session` + "Manage subscription" button.
7. **[P1]** Comped accounts + admin hooks (ties into `ADMIN_PANEL.md`).
8. **[P0]** Full test pass → switch to live keys.

---

## Open items to confirm
- [ ] Final **pricing** ($4.99 / $49.99 are placeholders).
- [ ] **Trial length** (14 days placeholder) and card-up-front vs. not.
- [ ] Exactly **which features** are gated vs. always-available.
- [ ] Comped accounts: **Stripe coupon** vs. app-side override.
