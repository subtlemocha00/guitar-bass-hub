# Architecture

How the app is put together and why. For setup, scripts and feature
descriptions see the [README](../README.md) — this document covers structure
and the reasoning behind it.

---

## Shape

A single-page React app with no server of its own. Firebase is the only
backend; everything else is static assets.

```text
main.jsx        hydrate storage -> mount <AuthProvider> -> <App/>
App.jsx         HashRouter + Suspense; every route lazy-loaded
components/     Layout, BackLink, ConfirmDialog, ErrorBoundary, ScrollToTop
platform/       the seams where web and native differ
features/       auth, songs, backingTracks, metronome, tuner, fretboard, setlist
firebase/       SDK init, per-user collection factory, shared prefs
pages/          thin route components
data/           static content (blog posts)
```

Two rules keep this navigable:

- **Pages are thin.** A page composes `Layout` plus one feature. Anything with
  logic lives in `features/`.
- **Features own their whole vertical.** Each feature directory holds its own
  hooks, Firestore module, storage module and CSS. Cross-feature imports are a
  smell — when a third feature needed `userPrefs`, it moved to `firebase/`
  rather than being imported across feature boundaries.

## Startup order

Order matters here and is easy to break:

```text
hydrateStorage()            async, once   -- storage.md explains why first
      |
ReactDOM.createRoot().render()
      |
<AuthProvider>              onAuthStateChanged, single listener app-wide
      |
App: if (loading) return null
      |
routes render
```

Storage hydrates **before** React mounts so features can read it synchronously
in `useState` initialisers. Auth resolves **after** mount behind a `loading`
gate, because the UI needs to exist before it can show a signed-in state.

## Routing

`HashRouter` is deliberate. Routes live in the URL fragment, so there are no
server rewrites, no deep-link 404s, and no change needed when the app is
packaged and served from a filesystem or custom-scheme origin.

Every route is lazy. `Home` included — it reads the song catalogue, so keeping
it eager pulled the Firestore SDK onto the critical path for routes that never
touch Firestore.

## Platform abstraction philosophy

The goal is not to abstract browser APIs. It is to make sure that **when a
behaviour differs between web and native, exactly one file changes.**

Three tests decide whether something belongs in `src/platform/`:

1. **Does the answer actually differ on native?** If not, a wrapper is pure
   indirection. `import.meta.env.PROD` is identical everywhere and is
   deliberately not wrapped.
2. **Is there a real call site?** Abstractions are built for code that exists,
   not code that might.
3. **Can the interface serve every target?** A synchronous storage API would
   have been unimplementable by Capacitor Preferences — see
   [storage.md](storage.md).

### What exists today

| Module | Owns | Native swap |
| --- | --- | --- |
| `platform/platform.js` | build target, `isWeb` / `isNative`, standalone, service-worker and connectivity checks | widen `platform()` to `desktop` / `ios` / `android` |
| `platform/links.js` | leaving the app (`openExternal`, `externalLinkProps`) | Tauri shell plugin / Capacitor Browser |
| `platform/auth/` | credential acquisition only | none for desktop — Tauri reuses the popup; mobile needs native Google Sign-In |
| `platform/storage/` | hydration, sync reads, async writes | Capacitor Preferences / Tauri store |

Each has one live implementation (`web*`), selected by build target where the
targets differ, and each selection folds away at build time — the native bundle
contains no web implementation and vice versa. `platform/auth/` is the exception
and the interesting case: the swap it was built for turned out not to be needed
on desktop, so it currently selects nothing. It stays because the *reason* for
the boundary held — credential acquisition is still the piece most likely to
differ per target, and mobile will differ.

### What is intentionally deferred

| Not built | Why |
| --- | --- |
| `platform/dialogs.js` | zero call sites. `window.confirm` was replaced by the React `ConfirmDialog` precisely because blocking dialogs misbehave in webviews |
| `platform/audio/` | Web Audio is identical in every webview; the tuner and metronome share no code beyond the name `AudioContext` |
| `platform/microphone.js` | boundary is documented in `useTuner.js`, but Capacitor needs a pre-request while Tauri needs an OS entitlement — the interface cannot be designed without a shell to test |
| `desktopAuth.js` / `mobileAuth.js` | desktop turned out not to need one — Tauri reuses the popup flow. A mobile model cannot be guessed without a shell to test |

Deferring is a decision, not an omission. Each of the above has a recorded
reason and a trigger for revisiting it.

## Web vs native separation

One Vite config, branching in two places only — base path and the PWA plugin.
See [platform-roadmap.md](platform-roadmap.md) for the build target table.

The separation is compile-time. `import.meta.env.VITE_BUILD_TARGET` is defined
by `vite.config.js`, `platform.js` derives `isNative` from it, and every
platform module branches on that constant. Minifiers fold the branch, so the
selection has no runtime cost and no dead implementation ships.

## Why behaviour stays platform-agnostic

Features must not know which platform they are on. A `if (isNative)` inside a
feature component is a bug in the abstraction, not a feature requirement.

The payoff is concrete: the auth migration touches one file because every
consumer reads `useAuthContext()`; the storage migration touches four files
because they all call `readItem`/`writeItem`. Had platform checks leaked into
components, both would have been sweeping refactors.

The corollary is that **the abstractions must be honest**. An interface that
only web can satisfy is worse than no interface, because it hides the problem
until migration day.
