# Project Tech Stack & Conventions

Use this document as the guiding spec for how to build this project. Follow these
choices, patterns, and theming conventions unless I explicitly ask otherwise.

---

## 1. Core Philosophy

- **Single-file first.** The entire app (markup, styling config, and logic) lives in
  one `index.html` when practical. No build step, no bundler, no framework runtime.
  Just open the file or serve it statically.
- **Vanilla everything.** Plain HTML, CSS, and modern vanilla JavaScript (ES2020+).
  No React/Vue/Svelte, no TypeScript, no npm build pipeline unless I ask for it.
- **CDN dependencies only.** Pull libraries from a CDN via `<script>`/`<link>` tags.
  Keep the dependency list tiny and purposeful.
- **Readable over clever.** Prefer clear, well-commented code. Every non-obvious
  function gets a short comment explaining *why*, not just *what*.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Markup | Semantic HTML5, single `index.html` |
| Styling | **Tailwind CSS via CDN** (`https://cdn.tailwindcss.com`) |
| Font | **Inter** from Google Fonts (weights 400–800) |
| Icons | **Lucide** (`lucide@latest` UMD build), re-init with `lucide.createIcons()` |
| Language | Vanilla JavaScript (ES modules-free, single `<script>` block) |
| State | A single plain `state` object + render functions |
| Persistence | `localStorage` (JSON snapshot), debounced saves |
| Local preview | `python3 -m http.server 5500` |
| Version control | Git; commit small and often |

### Standard `<head>` boilerplate

```html
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>App Name · Short Tagline</title>

  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          },
          keyframes: {
            popIn: {
              '0%':   { transform: 'scale(0)',    opacity: '0' },
              '70%':  { transform: 'scale(1.15)', opacity: '1' },
              '100%': { transform: 'scale(1)',    opacity: '1' },
            },
            fadeUp: {
              '0%':   { transform: 'translateY(8px)', opacity: '0' },
              '100%': { transform: 'translateY(0)',   opacity: '1' },
            },
          },
          animation: {
            popIn:  'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            fadeUp: 'fadeUp 0.3s ease-out both',
          },
        },
      },
    };
  </script>

  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>

  <!-- Google Font: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</head>
```

> Add other CDN libraries only when a real need arises (e.g. a well-tested utility
> library for a specific algorithm). Keep them pinned to a version.

---

## 3. Visual Theme & Design Language

A clean, modern, friendly SaaS look — soft, rounded, light UI with a single accent
color and tasteful micro-animations.

### Color

- **Neutral base:** Tailwind `slate` for text, borders, and muted UI
  (`text-slate-900`, `text-slate-500`, `border-slate-200`, `bg-slate-100`).
- **Accent:** pick ONE Tailwind color family and use it consistently for primary
  actions, active states, and highlights. (This project uses **emerald**; swap it
  for the new project's theme, e.g. `sky`, `violet`, `rose`.)
- **Semantic colors:** `emerald`/`green` = good, `rose`/`red` = warning/error,
  `amber` = caution/attention.
- **Surfaces:** white cards on a light neutral page background.

### Shape & depth

- **Rounded corners everywhere:** `rounded-lg`, `rounded-xl`, `rounded-2xl` for
  cards; `rounded-full` for pills, dots, and toggles.
- **Soft borders + subtle shadow:** `border border-slate-200 shadow-sm`.
- **Cards:** `bg-white rounded-2xl border border-slate-200 shadow-sm p-5`.
- **Generous spacing:** comfortable padding/gaps (`p-5`, `gap-3`), airy layouts.

### Typography

- **Inter**, with weight to establish hierarchy: `font-bold` headings,
  `font-semibold` labels, `font-medium` body emphasis.
- Small UI text is common: `text-xs` / `text-[11px]` / `text-[10px]` for labels,
  hints, and metadata.

### Buttons (patterns)

```html
<!-- Primary -->
<button class="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white
               hover:bg-emerald-700 shadow-sm transition flex items-center gap-1.5">
  <i data-lucide="check" class="w-3.5 h-3.5"></i> Save
</button>

<!-- Secondary / quiet -->
<button class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700
               hover:bg-slate-200 transition flex items-center gap-1.5">
  <i data-lucide="settings" class="w-3.5 h-3.5"></i> Options
</button>

<!-- Toggle chip (active vs inactive), toggled in JS -->
<button class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition
               bg-emerald-600 text-white hover:bg-emerald-700">Active</button>
```

- Icons pair with labels using `flex items-center gap-1.5`.
- Icons are small: `w-3.5 h-3.5` in buttons, `w-4 h-4`–`w-5 h-5` for headings.

### Pills / badges

```html
<span class="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Label</span>
```

### Motion

- Use the two custom animations: `animate-popIn` (elements appearing) and
  `animate-fadeUp` (banners/toasts sliding in).
- Add `transition` to interactive elements; hover states should feel responsive.
- Keep it subtle — animations are accents, never the main event.

### Custom range sliders

Style native range inputs to match (rounded track + accent thumb):

```css
input[type="range"] {
  -webkit-appearance: none; appearance: none;
  height: 6px; border-radius: 9999px; background: #e2e8f0; outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; border-radius: 9999px;
  background: #059669; /* accent-600 */ cursor: pointer; border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
```

---

## 4. JavaScript Architecture

A simple, predictable **state → render** loop. No framework, no virtual DOM.

### Single state object

```js
const state = {
  // ...all app data lives here, with an inline comment per field explaining it
  view: 'home',
  items: [],
  showGrid: true,
};
```

### Render functions rebuild the UI from state

- One top-level `renderAll()` that calls smaller `renderX()` functions.
- Render functions read `state` and set `innerHTML` / update DOM. After any render
  that adds icons, call `lucide.createIcons()`.
- Mutations go: **update `state` → call `renderAll()`**. Never hand-patch the DOM in
  ways that diverge from state.

```js
function renderAll() {
  renderHeader();
  renderCanvas();
  renderSidebar();
  lucide.createIcons();
  commitHistory(); // if using undo/redo
}
```

### Event handling

- Prefer **event delegation** on a container for lists of repeated elements, using
  `data-*` attributes to identify targets (e.g. `data-id`, `data-action`).
- For inputs, wire `input` for live updates and `blur`/`Enter` to commit + clamp.

### Undo / redo (optional but preferred pattern)

- Serialize the relevant slice of `state` to a JSON string (`historySnapshot()`).
- Keep `history.undo[]` / `history.redo[]` stacks with a size limit.
- A `suppressHistory` flag prevents re-recording while restoring.

### Persistence (localStorage)

- Reuse the history snapshot shape to auto-save. Debounce writes (~300ms) so rapid
  edits don't thrash storage. Wrap in `try/catch` for private mode / quota errors.

```js
const STORAGE_KEY = 'appName.state.v1';
let saveTimer = null;
function persistState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState())); }
  catch (e) { /* storage unavailable — ignore */ }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistState, 300);
}
function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) { /* ignore */ }
}
// On startup: loadPersistedState() BEFORE the first renderAll().
```

- Version the storage key (`.v1`) so schema changes are easy to migrate/invalidate.
- Include back-fill guards when restoring, so older/partial saves don't break new
  fields (default any missing property).

---

## 5. Code Style

- **Comments explain intent.** Especially for math, geometry, algorithms, and any
  non-obvious business rule. A short paragraph above a tricky function is expected.
- **Small, named helper functions** over long inline blocks.
- **Descriptive names**; avoid abbreviations except well-known ones.
- **Clamp and validate** all user input (`Math.max/min`, range checks).
- **Guard defensively** against missing data (`(obj || {}).prop`, early returns).
- Keep related constants in clearly-labeled tables/objects near the top of their
  section (e.g. lookup maps, config objects).

---

## 6. Workflow

- **Local preview:** `python3 -m http.server 5500`, open `http://localhost:5500/`.
  Use a `?v=<tag>` query string to bust the cache when reloading.
- **Git:** small, focused commits with clear messages. Include a `.gitignore`
  covering OS files (`.DS_Store`), editor folders, `node_modules/`, Python caches,
  logs, and env/secret files.
- **No secrets in the repo.** Use `.env` (gitignored) if any config is ever needed.

---

## 7. What to Avoid (unless I ask)

- ❌ Frameworks / SPA libraries (React, Vue, Svelte, Angular).
- ❌ Build tooling (Vite, Webpack, Rollup, Parcel) and TypeScript.
- ❌ CSS frameworks other than Tailwind; no CSS-in-JS.
- ❌ Heavy dependencies or many small ones.
- ❌ Over-engineering: no premature abstraction, no state libraries.

---

## 8. Quick Checklist for the LLM

When building or extending this project, make sure to:

- [ ] Keep it a single `index.html` with CDN Tailwind + Lucide + Inter.
- [ ] Drive the UI from one `state` object via `renderAll()` render functions.
- [ ] Re-run `lucide.createIcons()` after renders that add icons.
- [ ] Use the accent-color / rounded / soft-shadow theming consistently.
- [ ] Add `animate-popIn` / `animate-fadeUp` for tasteful motion.
- [ ] Persist to versioned `localStorage` with debounced, guarded saves.
- [ ] Clamp/validate input; comment the *why* behind non-obvious logic.
- [ ] Style native range inputs to match the theme.
