# Pre-Launch Checklist

A running list of everything to do before opening Garden Calendar to real users.
Check items off as you go. Priorities: **P0 = blocker**, **P1 = important**,
**P2 = nice-to-have**.

---

## 1. Authentication & email setup (P0)

Auth is now **email + password** and **social login (Google / GitHub)** via a
full-screen landing gate — no more magic links, so the email rate-limit is no
longer a blocker for basic sign-in. Email is only needed for optional
confirmation and password resets.

### Supabase auth configuration
- [ ] **URL configuration** (Authentication → URL Configuration):
  - **Site URL** = your production URL (e.g. `https://<your-domain>`).
  - **Redirect URLs**: add `https://<your-domain>` and `https://<your-domain>/**`
    (plus `http://localhost:5500` and `/**` for local dev). Required for OAuth
    redirects and confirmation links to return to the app.
- [ ] **Email confirmation decision** (Authentication → Providers → Email):
  - **Simplest launch:** turn **"Confirm email" OFF** so email+password sign-up
    logs users in immediately (the app already handles both cases). No email
    sent at all.
  - **More secure:** keep confirmation ON, but then you **must** set up custom
    SMTP below (built-in sender is rate-limited/not for production).
- [ ] **Set a minimum password length / strength** policy in Supabase (app
  enforces ≥6 chars client-side; mirror or raise it server-side).

### Social login (Google / GitHub)
- [ ] **Enable Google provider** (Authentication → Providers → Google):
  create OAuth credentials in Google Cloud Console, add the Supabase callback
  URL (`https://<project>.supabase.co/auth/v1/callback`) as an authorized
  redirect URI, paste Client ID + Secret into Supabase.
- [ ] **Enable GitHub provider**: create an OAuth App in GitHub developer
  settings, set the callback to the same Supabase callback URL, paste Client
  ID + Secret into Supabase.
- [ ] **Test each social button** end-to-end (redirect out and back, session
  established, data syncs).
- [ ] (Optional) Add more providers (Apple, etc.) — each needs its own button +
  provider setup.

### Custom SMTP (only if using email confirmation / password reset) (P1)
- [ ] **Pick a provider** (all have generous free tiers):
  - **Resend** — 3,000 emails/mo free, 100/day. Easiest DX. Recommended.
  - **SendGrid** — 100 emails/day free forever.
  - **Postmark** — 100 emails/mo free; excellent deliverability (paid after).
  - **Mailgun / Amazon SES** — cheap at scale, more setup.
- [ ] **Verify a sending domain** (e.g. `mail.yourdomain.com`) with the provider:
  add the **SPF**, **DKIM**, and **DMARC** DNS records they give you. This is
  what keeps emails out of spam.
- [ ] **Configure Supabase SMTP**: Dashboard → **Authentication → SMTP Settings**
  → enter host, port, username, password from the provider. Set a real
  **sender name** and **sender email** (e.g. `Garden Calendar <hello@yourdomain.com>`).
- [ ] **Customize email templates** (Authentication → Email Templates) for
  Confirm signup and Reset password — keep the `{{ .ConfirmationURL }}` /
  `{{ .Token }}` variables and add your branding.
- [ ] **Raise rate limits** if needed (Authentication → Rate Limits) once on
  custom SMTP.
- [ ] **Send real tests** to Gmail, Outlook, and iCloud; confirm delivery + not
  in spam.

### App-side follow-ups
- [x] **"Forgot password?" flow** — implemented in the auth gate
  (`resetPasswordForEmail` → returns via `PASSWORD_RECOVERY` → set new password).
  Requires custom SMTP (or the built-in sender within its limits) to deliver the
  reset email, plus the redirect URL allowlisted.
- [ ] Decide on a **custom domain** for the app itself (Vercel → Domains) so
  redirect URLs and emails all use your brand, not `*.vercel.app`.

---

## 2. Third-party APIs — terms & quotas (P0/P1)

The app calls several external services directly from the browser. Review each
for **terms of service**, **rate limits**, and **attribution** requirements, and
swap anything that isn't safe for production.

| Service | Used for | Cost / limits | Terms notes | Action |
|---|---|---|---|---|
| **Open-Meteo** (`api.open-meteo.com`, `archive-api.open-meteo.com`) | Weather forecast + historical | Free for **non-commercial**; no key needed | Non-commercial use free; commercial use needs a paid plan / API key. Attribution appreciated. | [ ] Confirm your use qualifies as non-commercial, or buy the commercial plan. Add attribution. |
| **Zippopotam.us** (`api.zippopotam.us`) | ZIP → lat/lon/city | Free, no key | Community project, **no SLA**, can go down. No documented rate limit. | [ ] Add graceful fallback; consider replacing with a more reliable geocoder (see below). |
| **timeapi.io** (`timeapi.io`) | Current time by timezone | Free, no key | Third-party, **no SLA**, rate limits unclear. | [ ] Evaluate if this call is even needed (browser has local time); remove or replace if flaky. |
| **Tailwind CDN** (`cdn.tailwindcss.com`) | CSS framework | Free | The CDN build is **explicitly not for production** (perf warning in console). | [ ] Replace with a compiled Tailwind CSS file (build step) before launch. |
| **unpkg** (`unpkg.com/lucide@latest`) | Icons | Free CDN | `@latest` can break unexpectedly; unpkg has no uptime guarantee. | [ ] Pin a version and/or self-host the Lucide bundle. |
| **jsDelivr** (`cdn.jsdelivr.net/.../supabase-js@2`) | Supabase client | Free CDN | Reliable, but pin exact version. | [ ] Pin to a specific `@2.x.y` version. |
| **Google Fonts** (`fonts.googleapis.com`) | Inter font | Free | GDPR note: serving from Google may log EU visitor IPs. | [ ] Optionally self-host Inter for privacy/perf. |

### Recommended API hardening
- [ ] **Pin all CDN versions** (no `@latest`) so a third-party release can't
  break production.
- [ ] **Self-host critical assets** where feasible (Tailwind compiled, Lucide,
  fonts) to remove third-party runtime dependencies.
- [ ] **Add fallbacks / error handling** for every network call so a dead API
  degrades gracefully instead of breaking the UI (weather/geocode already
  fail-soft — verify the rest).
- [ ] **Consider a more robust geocoder** (e.g. Open-Meteo's own geocoding API,
  which you already trust, or Nominatim with usage policy compliance) to
  replace Zippopotam.us.
- [ ] **Move third-party calls behind your own `/api/*` proxy** if you need to
  hide keys, add caching, or control rate limits.

---

## 3. Security & data (P0)

- [ ] **Verify Supabase Row-Level Security** is enabled on `garden_state` and
  policies only allow users to read/write **their own** row (already in the
  migration — confirm it's applied in prod).
- [ ] **Confirm only the anon key** is exposed to the browser (never the service
  role key). Check `/api/config` output.
- [ ] **Rotate keys** if the service role key was ever committed or shared.
- [ ] Confirm `.env.local` and any secrets are **gitignored** (they are) and set
  as **Vercel environment variables** for production.
- [ ] **Set security headers** (via `vercel.json`): `Content-Security-Policy`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`.
- [ ] **Sanitize all user-entered HTML** (notes use `contenteditable` + a
  sanitizer — audit `sanitizeNote()` against XSS before launch).
- [ ] **Rate-limit / protect** the `/api/config` and any other serverless
  endpoints from abuse.

---

## 4. Legal & compliance (P1)

- [ ] **Privacy Policy** — you store email + garden data in Supabase and call
  third-party APIs. Disclose what's collected and why.
- [ ] **Terms of Service** — set expectations, liability disclaimer.
- [ ] **Cookie/consent notice** if serving EU users (Google Fonts, analytics).
- [ ] **Account deletion / data export** — provide a way for users to delete
  their account and download their data (GDPR/CCPA).
- [ ] **Attribution** required by any API (e.g. Open-Meteo, OSM/Nominatim if used).

---

## 5. Reliability & UX polish (P1)

- [ ] **Error states**: friendly messages when APIs fail or the user is offline.
- [ ] **Loading indicators** for sign-in, sync, and weather fetches.
- [ ] **Empty states**: first-run experience for a brand-new (non-demo) user.
- [ ] **Sync conflict handling**: verify last-write-wins reconcile behaves well
  across two devices; consider a "synced X ago" indicator (badge exists).
- [ ] **Mobile QA** across iOS Safari + Android Chrome (search modal, filters,
  calendar views, modals).
- [ ] **Cross-browser QA**: Chrome, Safari, Firefox, Edge.
- [ ] **Accessibility pass**: keyboard nav, focus traps in modals, color
  contrast, `aria` labels, screen-reader check.
- [ ] **Favicon, app icons, and social/OpenGraph meta** for link previews.

---

## 6. Performance (P2)

- [ ] Replace Tailwind CDN with a **purged, minified** build (big win).
- [ ] **Self-host + preload** fonts; add `font-display: swap` (already swapping).
- [ ] **Minify** the single HTML/JS bundle for production.
- [ ] Run **Lighthouse**; target 90+ on Performance/Best Practices/SEO/A11y.
- [ ] Consider making the app a **PWA** (manifest + service worker) for offline
  use and installability — a natural fit given it's localStorage-first.

---

## 7. Observability & analytics (P2)

- [ ] **Error monitoring** (e.g. Sentry) to catch client-side exceptions.
- [ ] **Privacy-friendly analytics** (Plausible, Fathom, or Vercel Analytics) to
  see usage without heavy tracking.
- [ ] **Uptime monitoring** for the site and `/api/*` endpoints.
- [ ] **Supabase usage alerts** (row count, auth volume, bandwidth) so you're
  warned before hitting free-tier caps.

---

## 8. Launch mechanics (P1)

- [ ] **Custom domain** connected in Vercel with HTTPS.
- [ ] **Production env vars** set in Vercel (Supabase URL + anon key).
- [ ] **Verify prod build** deploys from `main` and `/api/config` returns
  `configured: true`.
- [ ] **Backups**: enable Supabase automated backups (or a periodic export).
- [ ] **Support channel**: a contact email or feedback form.
- [ ] **README / onboarding** copy updated for real users (not just devs).
- [ ] **Announce plan**: where/how you'll share it, and a rollback plan if
  something breaks.

---

## Quick "day-of-launch" smoke test
1. [ ] Load the production URL fresh (incognito) — no console errors.
2. [ ] Sign up with a real email → link arrives (not spam) → signs in.
3. [ ] Add a plant, planting, task, and note → reload → data persists.
4. [ ] Sign in on a second device → data syncs both ways.
5. [ ] Weather + ZIP lookup work for a real ZIP.
6. [ ] Global search finds plants/tasks/notes/locations.
7. [ ] Delete account / clear data works.
