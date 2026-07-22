# Guitar + Bass // Hub

A practice companion for guitar and bass players: tuner, metronome, fretboard
maps, a song catalog with progress tracking, backing tracks, and a reorderable
setlist. Built as an installable Progressive Web App.

---

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 (JavaScript, no TypeScript) |
| Build | Vite 8 |
| Routing | React Router 7, `HashRouter` |
| Styling | Plain CSS, one stylesheet per component (no UI framework) |
| Auth | Firebase Authentication — Google sign-in |
| Data | Cloud Firestore, per-user collections |
| Offline | `vite-plugin-pwa` (Workbox) app shell + Firestore persistent cache |
| Fonts | Orbitron, Rajdhani, JetBrains Mono — self-hosted, bundled |
| Audio | Web Audio API; `pitchy` for pitch detection |
| Drag & drop | `@dnd-kit` (setlist reordering) |

`HashRouter` is deliberate, not legacy: routes live in the URL fragment, so the
app needs no server-side rewrites and stays portable to a future desktop or
mobile wrapper.

---

## Getting started

```bash
npm install
cp .env.example .env      # then fill in your Firebase values
npm run dev
```

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server (service worker disabled) |
| `npm run build` | Web/PWA build to `dist/` (default target) |
| `npm run build:web` | Explicit alias for `npm run build` |
| `npm run build:native` | Native-wrapper build to `dist-native/` |
| `npm run preview` | Serve the web build locally |
| `npm run preview:native` | Serve the native build locally |
| `npm run lint` | ESLint (flat config, `eslint.config.js`) |

### Environment

All configuration comes from `VITE_FIREBASE_*` variables — see
[`.env.example`](.env.example) for the full list. These are client-side
identifiers rather than secrets; they ship in the bundle by design, and access
is controlled by Firestore security rules. Vite inlines them at build time, so
rebuild after any change.

---

## Features

**Tuner** — live pitch detection from the microphone. Guitar and bass, multiple
tunings, auto-detect or lock to a chosen string, with cents deviation and a
needle meter.

**Metronome** — sample-based Web Audio click, 40–300 BPM. Per-beat accent
patterns (two accent levels), subdivisions, swing, tap tempo, tempo ramping,
gap training and random mute. Both the live setup and named presets sync
across devices when signed in.
Scheduling uses a lookahead scheduler against `AudioContext.currentTime` rather
than `setTimeout`, so timing does not drift.

**Songs** — per-instrument catalogs. Each song holds a title, artist, tab URL,
optional YouTube link, free-text notes, and a status that cycles
planned → learning → completed. Sortable and filterable; the sort preference
follows the account across devices.

**Backing tracks** — saved jam tracks with genre, BPM and key, played inline via
embedded YouTube. Sample tracks are shown when signed out as a preview.

**Setlist** — every completed song across both instruments, drag-and-drop
reorderable, with the order persisted per account.

**Fretboard** — scale maps across the neck, 8 patterns × 12 roots, for both
4-string bass and 6-string guitar.

**Blog** — static, in-repo practice articles (`src/data/blogPosts.js`).

**Install** — installable as a PWA. The app shell, fonts, images and the 18
metronome WAV samples are precached, so the metronome and fretboard work fully
offline. Firestore data is served from a persistent local cache, so previously
loaded songs and tracks are available offline too.

---

## Project structure

```text
src/
  main.jsx              Entry point; mounts <AuthProvider>
  App.jsx               Routes (all lazy-loaded)
  components/           Layout, BackLink, ConfirmDialog, ErrorBoundary, ScrollToTop
  platform/             Platform seams: links (leaving the app), platform (web vs native)
  assets/fonts/         Self-hosted woff2 + @font-face declarations
  features/
    auth/               AuthProvider, AuthContext, useAuthContext
    songs/              Song catalog, cards, modals, status/notes/sort hooks
    backingTracks/      Backing track catalog
    metronome/          Scheduler, sound engine, presets, settings sync
    tuner/              Pitch detection hook, tuning definitions
    fretboard/          Scale map renderer (shared by both instruments)
    setlist/            Ordering hook and persistence
  firebase/
    firebase.js         App + Auth init (eager — gates first paint)
    db.js               Firestore + persistent cache (lazy — data routes only)
    userCollection.js   Factory for per-user Firestore subcollections
    userPrefs.js        users/{uid}.prefs — shared by sort, setlist, metronome
  pages/                Route-level components (thin wrappers over features)
  data/                 Static content (blog posts)
public/samples/         Metronome WAV samples
```

Pages are thin: a page composes `Layout` plus one feature. Anything with logic
lives under `features/`, and each feature owns its own hooks, storage module and
CSS.

Auth state comes from a single `<AuthProvider>` mounted in `main.jsx`. Read it
with `useAuthContext()` — there is exactly one `onAuthStateChanged` listener in
the app, and consumers must sit below the provider.

---

## Data model

Everything a signed-in user owns lives under their own document tree. There is
no shared or public collection.

```text
users/{uid}
  prefs: { "sort:guitar", "sort:bass", setlistOrder, metronome }

users/{uid}/songs/{songId}
  title, artist, tabUrl, youtubeUrl, instrument,
  status ("planned" | "learning" | "completed"), note, createdAt

users/{uid}/backingTracks/{trackId}
  title, artist, youtubeUrl, genre, bpm, trackKey, notes, instrument, createdAt

users/{uid}/metronomePresets/{presetId}
  name + full metronome settings, createdAt, updatedAt
```

`firebase/userCollection.js` builds the CRUD surface for the three
subcollections from one implementation, including a per-collection allowlist of
writable fields. Writes never throw — they resolve to `{ ok: true, ... }` or
`{ ok: false, code, message }` so callers can report failures instead of losing
data silently.

Song notes are debounced (~600 ms) and flushed when the card unmounts or the
page is hidden, so typing a note is one write rather than one per keystroke.

Firestore runs with a persistent (IndexedDB) local cache, shared across tabs.
Previously loaded data renders immediately on a cold offline start, and writes
made offline are queued and replayed on reconnect. If the environment refuses
persistence, `firebase/db.js` falls back to an in-memory Firestore and
everything still works, just without the cache.

### What is stored locally as well

These use the same dual-write pattern: `localStorage` is written immediately
(instant, works signed out and offline) and Firestore is the source of truth
whenever the user is signed in.

- **Live metronome setup** (BPM, sounds, swing, gap training…) —
  `useMetronomeSettingsSync`. Writes are debounced ~800 ms and flushed on
  unmount and `pagehide`. On first sign-in on a device, an account with no
  stored setup is seeded from that device once (uid-scoped flag).
- **Song sort preference** — `useSortPreference`.
- **Cloud preset cache** — a `localStorage` mirror of the user's named presets
  so they paint before Firestore responds. Firestore is authoritative.

See the header comment in `features/metronome/metronomeStorage.js` for the full
key-by-key breakdown.

Signed out, the app is read-only: sample backing tracks are shown as a preview,
and the metronome setup and presets fall back to local-only storage.

---

## Build targets

One Vite config produces two builds, selected with Vite's `--mode` flag. It
branches in exactly two places (base path, PWA plugin) rather than duplicating
configuration.

| | **web** (default) | **native** |
| --- | --- | --- |
| Command | `npm run build` | `npm run build:native` |
| Mode | `production` | `native` |
| Output | `dist/` | `dist-native/` |
| Base | `/` on Vercel, else `/guitar-bass-hub/` | `./` |
| `vite-plugin-pwa` | enabled | not applied |
| Service worker | registered | never registered |
| Manifest / precache | yes | no |

**web** is the current, shipping behaviour and is unchanged — same base logic,
same service worker, same Workbox caching, same output directory.

**native** is the target a Tauri or Capacitor shell will package. It differs
only where a webview forces it to:

- **`base: './'`** — a packaged app loads from `file://` or a custom scheme, so
  absolute asset paths like `/guitar-bass-hub/assets/…` would 404. Relative
  paths resolve against wherever the shell mounted the app.
- **No service worker** — unsupported on iOS WKWebView custom schemes, and
  elsewhere it competes with the native asset loader and can pin users to a
  stale build. The PWA plugin is omitted from the plugin list entirely, which
  also removes the registration snippet it injects into `index.html`.
- **Separate output directory** so a native build can never be published to the
  web by accident (`npm run deploy` reads `dist/`).

PWA support is not removed; native simply bypasses it. Routing needs no change
either way — `HashRouter` keeps routes in the URL fragment, so there are no
server rewrites and no deep-link 404s from a filesystem origin.

`import.meta.env.VITE_BUILD_TARGET` is defined as `"web"` or `"native"` for app
code that needs to branch at runtime.

Neither Tauri nor Capacitor is installed yet; this is build-system preparation
only.

## Deployment

The web build deploys as a static site on Vercel. `vite.config.js` picks the
base path from the `VERCEL` environment variable, falling back to
`/guitar-bass-hub/` for a project-page style deploy.

### Desktop

A Tauri shell wraps the same codebase for Windows. `npm run tauri:build`
produces `guitar-bass-hub.exe` and an NSIS installer; full prerequisites,
security posture and known gaps are in [docs/release.md](docs/release.md).

The desktop build is **not yet distributable** — it is unsigned, so SmartScreen
warns on first run, and there is no update mechanism.

---

## Developer documentation

Deeper background lives in [`docs/`](docs/):

| Document | Covers |
| --- | --- |
| [architecture.md](docs/architecture.md) | Structure, startup order, the platform abstraction philosophy, and what is deliberately deferred |
| [storage.md](docs/storage.md) | Hydration layer, why a synchronous wrapper was rejected, future native drivers |
| [data-model.md](docs/data-model.md) | Firestore ownership, local keys, dual-write pattern, migration flags |
| [platform-roadmap.md](docs/platform-roadmap.md) | Phase status and the expected work for Tauri/Capacitor |
| [release.md](docs/release.md) | Building the desktop app and its installer, security posture, distribution blockers |
| [desktop-polish.md](docs/desktop-polish.md) | Desktop UX pass: window behaviour, external links, dialog focus |
| [tauri-poc.md](docs/tauri-poc.md) | Desktop shell proof of concept: setup, findings, limitations |
| [tauri-auth-investigation.md](docs/tauri-auth-investigation.md) | Desktop sign-in options, what is proven vs unknown, open questions |
| [mobile-auth.md](docs/mobile-auth.md) | Capacitor native Google sign-in: chosen plugin, the `@auth-impl` build alias, native config checklist |
| [youtube-native-compatibility.md](docs/youtube-native-compatibility.md) | Embed audit: known behaviour, expected native risks, open decisions |

---

## Status

Actively developed and in daily use. The next planned work is the desktop and
mobile wrappers themselves; the app-side preparation for them is done.
