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
| Offline | `vite-plugin-pwa` (Workbox) — app shell, images and metronome samples |
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
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built output locally |
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
gap training and random mute. Named presets sync across devices when signed in.
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

**Install** — installable as a PWA. The app shell, images and the 18 metronome
WAV samples are precached, so the metronome and fretboard work fully offline.
Firestore-backed data currently requires a connection on first load.

---

## Project structure

```text
src/
  main.jsx              Entry point; mounts <AuthProvider>
  App.jsx               Routes (all lazy-loaded except Home)
  components/           Layout, BackLink, ErrorBoundary, ScrollToTop
  features/
    auth/               AuthProvider, AuthContext, useAuthContext
    songs/              Song catalog, cards, modals, status/notes/sort hooks
    backingTracks/      Backing track catalog
    metronome/          Scheduler, sound engine, presets, local settings
    tuner/              Pitch detection hook, tuning definitions
    fretboard/          Scale map renderer (shared by both instruments)
    setlist/            Ordering hook and persistence
  firebase/
    firebase.js         SDK initialisation
    userCollection.js   Factory for per-user Firestore subcollections
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
  prefs: { "sort:guitar", "sort:bass", setlistOrder }

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

### What is stored locally instead

- **Live metronome setup** (BPM, sounds, swing, gap training…) — `localStorage`,
  this device only. See the header comment in
  `features/metronome/metronomeStorage.js`; this should move to Firestore
  before the app is packaged for desktop/mobile.
- **Song sort preference** — written to both `localStorage` (instant, works
  signed out) and Firestore (follows the account).
- **Cloud preset cache** — a `localStorage` mirror of the user's presets so they
  paint before Firestore responds. Firestore is authoritative.

Signed out, the app is read-only: sample backing tracks are shown as a preview
and metronome presets fall back to local-only storage.

---

## Deployment

Deployed as a static site on Vercel. `vite.config.js` picks the base path from
the `VERCEL` environment variable, falling back to `/guitar-bass-hub/` for a
project-page style deploy. A packaged desktop/mobile build would need a
relative base (`./`) and the service worker disabled.

---

## Status

Actively developed and in daily use. The next planned work is preparation for
native desktop/mobile wrappers — see the storage notes in
`features/metronome/metronomeStorage.js` for the main outstanding item.
