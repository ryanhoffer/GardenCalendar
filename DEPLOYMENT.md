# Deploying Garden Calendar to Vercel + Supabase

This document is a **step-by-step implementation plan written for an LLM coding agent**
to follow. It takes the current single-file, `localStorage`-only app
(`index.html`) and turns it into a deployed web app hosted on **Vercel** with
authenticated, cloud-synced data stored in **Supabase**.

> **Audience:** an autonomous LLM agent with terminal + file-editing tools.
> **Goal:** working production deployment with per-user data sync, while
> preserving the app's "single-file, vanilla JS, no build step" philosophy as
> much as possible.

---

## 0. Context the agent must load first

Before writing any code, read these files to understand the app:

- `index.html` — the entire app (markup + Tailwind CDN config + all JS).
- `TECH_STACK.md` — the project's conventions (single-file, vanilla, CDN-only).
- `README.md` — product overview.

### Key facts about the current app

| Aspect | Current implementation |
|---|---|
| Structure | One `index.html`, no build step, Tailwind + Lucide via CDN |
| State | A single global `state` object + `renderAll()` render loop |
| Persistence | `localStorage` key `gardenCalendar.state.v3`, debounced 300 ms via `scheduleSave()` |
| Save fn | `persistState()` (writes JSON snapshot) |
| Load fn | `loadPersistedState()` (reads + migrates snapshot) |
| External APIs | Open-Meteo (weather, keyless), Zippopotam (ZIP→lat/lon), timeapi.io |
| Persisted keys | `veggies, tasks, view, filter, typeFilter, locationFilter, taskLocations, hiddenVegs, hiddenPlantings, notes, location, frostDates, weather, seq` |

**Design principle for this migration:** keep `localStorage` as the source of
truth for the UI (offline-first). Supabase becomes a **sync layer** on top —
the app stays fully functional with no network. This avoids a rewrite of the
render loop.

---

## 1. Prerequisites & accounts

The agent should confirm (or instruct the user to provide) the following:

1. A **Vercel** account + the Vercel CLI (`npm i -g vercel`).
2. A **Supabase** account + the Supabase CLI (`npm i -g supabase`).
3. A **GitHub** repo (already exists: `ryanhoffer/GardenCalendar`).
4. Node.js 18+ installed locally.

> **Secrets the agent will need** (never hard-code these into `index.html`):
> - `SUPABASE_URL`
> - `SUPABASE_ANON_KEY`
>
> The anon key is safe to expose in a browser **only** when Row Level Security
> (RLS) is enabled (Step 4). Treat the service-role key as a hard secret — it
> must never appear in client code.

---

## 2. Repository restructure

Keep the single-file app but add the minimal scaffolding Vercel expects.

```
Garden Calendar/
├── public/
│   └── index.html          # move the existing app here (static asset root)
├── api/
│   └── config.js           # serverless fn: serves public Supabase config
├── vercel.json             # routing + headers
├── package.json            # scripts + (optional) supabase dep for local dev
├── .env.local              # local secrets (gitignored)
├── .gitignore
├── DEPLOYMENT.md
├── README.md
└── TECH_STACK.md
```

**Agent actions:**

1. `mkdir -p public api`
2. `git mv index.html public/index.html`
3. Create the files described in the following steps.
4. Update `.gitignore` to include:
   ```
   .env.local
   .env*.local
   .vercel
   node_modules
   ```

---

## 3. Supabase project setup

### 3.1 Create the project

Either via the dashboard (https://supabase.com/dashboard) or CLI:

```bash
supabase projects create garden-calendar --org-id <ORG_ID> --region us-east-1
```

Record the **Project URL** and **anon public key** from
*Project Settings → API*.

### 3.2 Database schema

Create a single-row-per-user document table. Because the app already serializes
its whole world into one JSON blob, mirror that: store the snapshot as `jsonb`.
This is the lowest-friction path and keeps parity with `localStorage`.

Create `supabase/migrations/0001_init.sql`:

```sql
-- One JSON document per authenticated user.
create table if not exists public.garden_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_garden_state on public.garden_state;
create trigger trg_touch_garden_state
  before update on public.garden_state
  for each row execute function public.touch_updated_at();
```

Apply it:

```bash
supabase db push
```

> **Optional (future, not required for v1):** if the user later wants
> relational querying, normalize into `veggies`, `tasks`, `notes`, etc. tables.
> For this migration, the single `jsonb` document is the correct scope.

---

## 4. Row Level Security (CRITICAL)

Without RLS, the anon key would let anyone read/write all rows. Enable it so
each user can only touch their own row.

Add to the same migration (`0001_init.sql`):

```sql
alter table public.garden_state enable row level security;

create policy "read own state"
  on public.garden_state for select
  using (auth.uid() = user_id);

create policy "insert own state"
  on public.garden_state for insert
  with check (auth.uid() = user_id);

create policy "update own state"
  on public.garden_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Re-run `supabase db push` after adding these.

**Verification the agent must perform:** confirm `select` from an anonymous
session returns zero rows, and that a logged-in user only sees their own row.

---

## 5. Serve Supabase config without a build step

The app uses no bundler, so there's no `import.meta.env`. Expose the **public**
config through a tiny Vercel serverless function instead of hard-coding it.

Create `api/config.js`:

```js
// Returns the PUBLIC Supabase config for the browser.
// Only the URL + anon key — both safe to expose because RLS is enabled.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}
```

Create `.env.local` (gitignored) for local dev:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key>
```

These same two variables must be added in **Vercel → Project → Settings →
Environment Variables** (Production, Preview, and Development scopes).

---

## 6. Client-side integration (in `public/index.html`)

Keep everything vanilla + CDN. Add the Supabase JS client from a CDN and a small
**sync module**. Do **not** rip out `localStorage` — layer sync on top of it.

### 6.1 Add the CDN script

In `<head>` (or just before the app's `<script>`), add:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 6.2 Add an auth + sync layer

Insert a new `<script>` block that runs **before** the app's existing logic
loads persisted state. It must:

1. `fetch('/api/config')` to get `supabaseUrl` + `supabaseAnonKey`.
2. Create the client: `const sb = supabase.createClient(url, anonKey)`.
3. Provide **magic-link email auth** (simplest, no password UI):
   ```js
   async function signIn(email) {
     await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
   }
   async function signOut() { await sb.auth.signOut(); }
   ```
4. On load / auth state change:
   - If **signed out** → app behaves exactly as today (localStorage only).
   - If **signed in** → run the sync reconcile (Step 6.3).

### 6.3 Reconcile strategy (localStorage ⇄ Supabase)

Because both sides can change, use **last-write-wins by timestamp**, with the
cloud winning ties. Add a `updatedAt` epoch to the saved snapshot.

Pseudo-flow the agent should implement:

```
on sign-in:
  cloud = select data, updated_at from garden_state where user_id = me
  local = JSON.parse(localStorage[STORAGE_KEY])   // may be null

  if cloud exists and (local missing OR cloud.updated_at >= local.updatedAt):
     write cloud.data into localStorage, then call loadPersistedState() + renderAll()
  else if local exists:
     upsert local into cloud (garden_state)
  // else: nothing to do

subscribe: wrap scheduleSave() so every debounced local save ALSO upserts to
           cloud when a session is active.
```

### 6.4 Hook into existing save

The app already centralizes writes in `persistState()` / `scheduleSave()`.
The agent should **wrap** (not replace) `persistState` so it additionally
upserts to Supabase when authenticated:

```js
const _persistState = persistState;
persistState = function () {
  _persistState();                       // existing localStorage write
  const session = sbSessionRef.current;  // however the agent tracks it
  if (session) {
    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    snapshot.updatedAt = Date.now();
    sb.from('garden_state').upsert({
      user_id: session.user.id,
      data: snapshot,
    }).then(() => {}, () => {}); // fire-and-forget; offline stays fine
  }
};
```

> **Important:** keep failures silent/non-blocking. Offline or logged-out use
> must never break — that's the whole offline-first premise.

### 6.5 Minimal auth UI

Add a small control in the sidebar header (near "My Zone"): an email input +
"Sign in" button when logged out, and the user's email + "Sign out" when logged
in. Match the existing Tailwind styling and re-run `lucide.createIcons()` after
DOM changes, per project convention.

---

## 7. Vercel configuration

Create `vercel.json`:

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

Create `package.json` (no build needed — it's static + serverless):

```json
{
  "name": "garden-calendar",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel --prod"
  }
}
```

Because `public/` holds the static site and `api/` holds functions, Vercel's
zero-config detection serves `public/index.html` at `/` and `api/config.js` at
`/api/config` automatically.

---

## 8. Local verification (before deploying)

The agent must run and confirm each of these:

1. `vercel dev` boots the app at `http://localhost:3000`.
2. `curl -s http://localhost:3000/api/config` returns JSON with the URL + anon key.
3. The app loads, and **logged-out** behavior is unchanged (localStorage works).
4. Sign in via magic link → data uploads; check the Supabase table has one row
   for the user.
5. Edit data → confirm the row's `data` + `updated_at` change.
6. Load the app in a second browser/profile, sign in as the same user →
   confirm the cloud data hydrates.
7. Sanity checks from the existing workflow still pass:
   ```bash
   grep -c 'DOCTYPE' public/index.html   # expect 1
   ```

---

## 9. Deploy

```bash
# First-time link
vercel link

# Push env vars (or add them in the dashboard)
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY

# Ship to production
vercel --prod
```

Then in **Supabase → Authentication → URL Configuration**, add the Vercel
production domain (and any preview domains) to **Redirect URLs** so magic-link
sign-in redirects back correctly.

---

## 10. Post-deploy checklist

- [ ] Production URL loads and renders the calendar.
- [ ] `/api/config` returns config in production (env vars set for Production scope).
- [ ] Magic-link email arrives and redirects back signed in.
- [ ] RLS verified: a second user cannot read the first user's row.
- [ ] Offline/logged-out use still works (disable network, reload — app functions).
- [ ] Weather + ZIP lookups still work (they're third-party, unchanged).
- [ ] CI: pushing to `main` triggers an automatic Vercel production deploy.

---

## 11. Scope guardrails for the agent

**Do:**
- Preserve the single-file, no-build, offline-first design.
- Keep all secrets out of `index.html`; only the anon key reaches the browser.
- Make every network call fail-soft (never block the UI).
- Enable RLS **before** exposing the anon key anywhere.

**Do NOT:**
- Introduce React/Vue/TypeScript or a bundler.
- Normalize the schema into many tables (out of scope for v1).
- Put the service-role key in client code or `api/config.js`.
- Remove `localStorage` — it remains the UI's source of truth.

---

## 12. Rollback plan

If anything regresses:

1. `vercel rollback` reverts to the previous production deployment.
2. The app remains usable as a pure static file — reverting to the pre-migration
   commit (`git revert` / checkout `public/index.html` → `index.html`) restores
   the original localStorage-only app with zero backend dependencies.
