# Garden Calendar 🌱# App Name



Plan your growing season, one task at a time.Short tagline goes here.



A single-file web app for planning garden tasks on a calendar. Add your plants,A single-file web app built with a deliberately minimal, no-build stack. Just open

then schedule key activities — sowing, transplanting, watering, fertilizing,`index.html` — no bundler, no framework runtime, no install step.

pruning, harvesting — and see them laid out across **Month**, **Year**, and

**List** views. No build step, no install. Just open `index.html`.## Tech stack



## Features- **HTML5** — one `index.html` holds markup, config, and logic

- **Tailwind CSS** (CDN) — utility-first styling with a custom accent theme

- **Plant manager** — add the vegetables/plants you're growing; each gets its own- **Lucide** — icon set (re-init via `lucide.createIcons()` after renders)

  color and a running count of scheduled tasks.- **Inter** — Google Font

- **Three calendar views**- **Vanilla JS** — a single `state` object + `renderAll()` render loop

  - **Month** — full grid; click any day to add a task, click a task pill to edit.- **localStorage** — versioned, debounced auto-save

  - **Year** — 12 mini-months at a glance; days with tasks are highlighted, and

    clicking a month name jumps to its month view.See `../TECH_STACK.md` for the full conventions guide this template follows.

  - **List / Agenda** — all tasks sorted into *Upcoming* and *Past*.

- **8 garden task types**, each with its own icon + color: Sow Indoors, Direct Sow,## Run locally

  Transplant, Water, Fertilize, Prune, Harvest, and Other.

- **Repeating tasks** — schedule recurring jobs (weekly, biweekly, monthly) in oneNo dependencies to install. Serve the folder with any static server:

  step, e.g. "water every week for 8 weeks."

- **Notes** on any task (e.g. "Start seeds indoors under lights").```sh

- **Auto-save** to `localStorage` — your garden plan persists between visits.python3 -m http.server 5500

```

## Tech stack

Then open <http://localhost:5500/>. Add a `?v=<tag>` query string to bust the cache

- **HTML5** — one `index.html` holds markup, config, and logicwhen reloading (e.g. `http://localhost:5500/?v=2`).

- **Tailwind CSS** (CDN) — utility-first styling with a custom accent theme

- **Lucide** — icon set (re-init via `lucide.createIcons()` after renders)Or simply open `index.html` directly in a browser.

- **Inter** — Google Font

- **Vanilla JS** — a single `state` object + `renderAll()` render loop## Project structure

- **localStorage** — versioned, debounced auto-save

```

See `../TECH_STACK.md` for the full conventions guide this template follows.starter-template/

├── index.html    # the entire app (UI + logic)

## Run locally├── README.md     # this file

└── .gitignore

No dependencies to install. Serve the folder with any static server:```



```sh## How it works

python3 -m http.server 5500

```- **State → render.** All data lives in a single `state` object. To change the UI,

  mutate `state` then call `renderAll()`. Never hand-patch the DOM out of sync.

Then open <http://localhost:5500/>. Or simply open `index.html` directly in a browser.- **Persistence.** `renderAll()` schedules a debounced save to `localStorage` under a

  versioned key (`appName.state.v1`). On startup, `loadPersistedState()` restores the

## How it works  last session before the first render. Bump the key version to invalidate old saves.

- **Events.** Repeated lists use event delegation with `data-*` attributes.

- **State → render.** All data lives in a single `state` object

  (`veggies`, `tasks`, `view`, `cursor`). To change the UI, mutate `state` then call## Make it yours

  `renderAll()`.

- **Task types** are defined once in the `TASK_TYPES` map (label, icon, color). Add or1. Rename the title, app name, and tagline.

  edit types there and they flow through every view, the legend, and the modal.2. Change the accent color in **one place** — set the `ACCENT` constant near the top

- **Dates** are stored as `YYYY-MM-DD` strings; helpers (`toISO`, `parseISO`) keep   of `index.html` (`emerald` | `sky` | `violet` | `rose` | `amber` | `indigo` |

  timezone math simple and local.   `teal` | `orange` | `fuchsia` | `slate`). It drives every `accent-*` class and the

- **Persistence.** `renderAll()` schedules a debounced save to `localStorage` under   slider. Add more options to the `PALETTES` object.

  `gardenCalendar.state.v1`. Bump that key to invalidate old saves.3. Bump `STORAGE_KEY` to a unique name for your app.

4. Replace the two demo cards with your real features, keeping the state→render pattern.

## Make it yours

1. Change the accent color in one place — the `ACCENT` constant near the top of
   `index.html` (`emerald` | `sky` | `violet` | `rose` | `amber` | `teal` | `orange`).
2. Add new task types to the `TASK_TYPES` object.
3. Adjust the recurring-task presets in `expandRepeat()`.
