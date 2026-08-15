# MVP — Launch Deliverables

The minimum set of deliverables to launch **Garden Calendar** publicly.
Completed items are checked; remaining work is grouped by priority
(**P0 = launch blocker**, **P1 = important**, **P2 = post-launch OK**).

Related docs: `PRE_LAUNCH.md` (detailed ops checklist), `DEPLOYMENT.md`,
`TECH_STACK.md`.

---

## ✅ Done (already built)

### Core app
- [x] Single-file web app (`public/index.html`) — HTML + Tailwind + vanilla JS.
- [x] **Plants** management (add, rename, color, icon, delete).
- [x] **Plantings** (per-plant successions/varieties) with colors + icons.
- [x] **Tasks** with 8 types (sow indoors, direct sow, transplant, water,
  fertilize, prune, harvest, other).
- [x] **Recurring tasks** with repeat rules, exceptions, and per-occurrence edits.
- [x] **Task completion** (planned vs. done, done-date tracking).
- [x] **Locations** (garden beds/areas) with colors + icons.
- [x] **Notes** system: rich-text logs on plants, plantings, days, months, years,
  locations, plus per-task notes.
- [x] **Views**: Day, Week, Month, Year, List, Notes.
- [x] **Filters**: by plant/planting, task type, and location.
- [x] **Frost dates** per year + **weather** integration (Open-Meteo).
- [x] **Grow zone / ZIP** lookup.
- [x] **Demo garden** seed + **clear all** data.

### Recently added this cycle
- [x] **Global command-palette search** (⌘K / Ctrl-K) across plants, plantings,
  tasks, notes, and locations.
- [x] **Mobile responsive** layout (header, view switcher, toolbar filters,
  calendar views, modals).
- [x] **Cloud sync** via Supabase (offline-first; localStorage is source of
  truth, syncs when signed in).
- [x] **Auth reimagined**: full-screen landing gate with **email + password**,
  **social login (Google / GitHub)**, and "continue without an account."
- [x] **Forgot-password / reset** flow.

### Infrastructure
- [x] Deployed on **Vercel** from `main` (auto-deploy).
- [x] `/api/config` serverless function serves public Supabase config.
- [x] **Supabase** project + `garden_state` table + **RLS policies**
  (users read/write only their own row).
- [x] Migration file (`supabase/migrations/0001_init.sql`).
- [x] Secrets via env vars (`.env.local` gitignored, Vercel env configured).
- [x] Docs: `README.md`, `DEPLOYMENT.md`, `TECH_STACK.md`, `PRE_LAUNCH.md`.

---

## 🚧 To do before launch

### P0 — Blockers
- [ ] **Billing (Stripe) — paid at launch.** Products/prices, Checkout, Customer
  Portal, webhooks → Supabase sync, and paywall/feature gating. Full spec in
  `ADMIN_PANEL.md` §0.
- [ ] **Fix auth email rate limit** — either turn **"Confirm email" OFF** in
  Supabase (instant signups, no email) **or** configure custom SMTP.
  (Currently signups fail with "email rate limit exceeded.")
- [ ] **Supabase URL configuration** — set **Site URL** + **Redirect URLs** for
  production (and localhost) so OAuth + password-reset links return correctly.
- [ ] **Enable social providers** in Supabase (Google + GitHub OAuth apps,
  client IDs/secrets, callback URLs) — the buttons exist but need backend setup.
- [ ] **End-to-end auth test** in production: signup, login, Google, GitHub,
  forgot-password, sign-out, and cross-device sync.
- [ ] **Verify RLS in production** — confirm a user cannot read/write another
  user's data.
- [ ] **Replace Tailwind CDN** with a compiled/purged build (the CDN build warns
  it's not for production).

### P1 — Important
- [ ] **Custom domain** on Vercel (HTTPS) so URLs/emails aren't `*.vercel.app`.
- [ ] **Custom SMTP** (Resend/SendGrid/etc.) for reliable confirmation + reset
  emails (required if email confirmation stays on).
- [ ] **Privacy Policy** + **Terms of Service** (you store email + garden data).
- [ ] **Account deletion / data export** (GDPR/CCPA).
- [ ] **Security headers** in `vercel.json` (CSP, HSTS, X-Content-Type-Options,
  Referrer-Policy).
- [ ] **Audit note sanitizer** (`sanitizeNote()`) against XSS.
- [ ] **Pin CDN versions** (Lucide `@latest`, Supabase, jsDelivr) so a third
  party can't break prod.
- [ ] **Third-party API review** — confirm Open-Meteo non-commercial terms fit;
  harden/replace Zippopotam.us + timeapi.io (no SLA). See `PRE_LAUNCH.md` §2.
- [ ] **Error + empty + loading states** for auth, sync, and network calls.
- [ ] **Cross-browser + mobile QA** (Chrome, Safari, Firefox, Edge; iOS/Android).
- [ ] **Favicon, app icons, OpenGraph/social meta** for link previews.

### P2 — Nice to have (can follow launch)
- [ ] **PWA** (manifest + service worker) for install + offline.
- [ ] **Analytics** (privacy-friendly: Plausible / Vercel Analytics).
- [ ] **Error monitoring** (Sentry) + **uptime monitoring**.
- [ ] **Supabase usage alerts** (stay under free-tier caps).
- [ ] **Accessibility pass** (keyboard nav, focus traps, contrast, aria labels).
- [ ] **Automated backups** / periodic export of Supabase data.
- [ ] **Performance pass** (minify bundle, self-host fonts, Lighthouse 90+).
- [ ] **Change-password** affordance for signed-in users (account card).
- [ ] **Support channel** (contact email or feedback form).

---

## ✨ Pre-launch features (user-facing)

Distinct from the infra/legal items above — these are product features that
improve the first-run experience and retention. Priorities reflect impact vs.
effort given what's already built.

### Recommended before launch (P0-ish for a good first impression)
- [ ] **First-run onboarding / empty state** — new users who skip the demo land
  on a blank calendar today. Add a friendly empty state or a short guided
  "add your first plant → planting → task" flow. *Low effort, high activation.*
- [ ] **PWA / "Add to Home Screen"** — add a web manifest + service worker.
  Builds on existing offline-first localStorage + mobile layout; makes the app
  installable and feel native. *Small effort, strong "realness" + retention.*
- [ ] **Account menu polish**
  - [ ] **Change password** for signed-in users (complements the reset flow).
  - [ ] **Delete account + export data** (also a legal requirement; visible
    feature worth building once).
- [ ] **"Today / This week" focus view or dashboard** — a quick "what needs
  doing now" summary. The single most useful recurring interaction for a task
  app; drives daily return visits. *Can be a lightweight widget/badge on top of
  the existing List view.*

### Nice to have (fast-follows; cheap wins if time allows)
- [ ] **Onboarding location prompt** — ask for ZIP up front to unlock frost
  dates + weather immediately (the best "wow" feature) instead of hiding it.
- [ ] **Task templates / quick-add per plant** — e.g. "Start tomatoes" seeds a
  set of typical tasks. Reduces manual-entry tedium for new users.
- [ ] **iCal / Google Calendar export** — surface tasks where people already
  look. Strong retention lever, moderate effort.
- [ ] **Harvest logging** — record actual harvest date/qty vs. expected. Turns
  the planner into a season journal; drives year-over-year return.

### Explicitly deferred to post-launch
- Companion-planting hints
- Multi-garden / multi-bed management
- Sharing / collaboration
- Push / email reminders
- Weather-based alerts (frost/heat warnings)

### 🎯 Tight-launch shortlist (if picking just three)
1. **Onboarding / empty state** — activation.
2. **PWA install** — retention + "realness."
3. **Change password + delete/export account** — closes the auth loop + legal.

---

## 🎯 Definition of "MVP launch-ready"
All **P0** items complete, plus the launch-critical **P1** items:
Privacy Policy, Terms, account deletion, and a custom domain. Everything else
(P2) can ship shortly after.

## Day-of-launch smoke test
1. [ ] Load production URL fresh (incognito) — no console errors.
2. [ ] Create an account (email+password) → lands in the app.
3. [ ] Log in with Google and GitHub.
4. [ ] Forgot-password → reset email → set new password → signed in.
5. [ ] Add a plant, planting, task, and note → reload → data persists.
6. [ ] Sign in on a second device → data syncs both ways.
7. [ ] Weather + ZIP lookup work for a real ZIP.
8. [ ] Global search finds plants/tasks/notes/locations.
9. [ ] Clear data / delete account works.
