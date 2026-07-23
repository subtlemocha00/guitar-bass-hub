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
| `platform/platform.js` | build target, `APP_VERSION`, `runtimeLabel()`, standalone, service-worker, connectivity checks, app-background flush (`subscribeToAppBackground`) | `platform()`/`runtimeLabel()` widened to `desktop`/`ios`/`android`; `subscribeToAppBackground` is now **live** — it re-exports the `@lifecycle-impl` alias (web/Tauri `pagehide`, Capacitor `@capacitor/app` `appStateChange`) |
| `platform/links/` | leaving the app (`openExternal`, `externalLinkProps`) | **live** — `webLinks`/`tauriLinks`/`capacitorLinks` selected by the `@links-impl` build alias (web `window.open`, Tauri opener, Capacitor `@capacitor/browser` `Browser.open`); the click-interception decision stays an in-source `isWeb` branch |
| `platform/auth/` | credential acquisition only | **live** — web/Tauri use `webAuth` (popup); Capacitor uses `mobileAuth` (native Google Sign-In → `signInWithCredential`). Selected by the `@auth-impl` build alias, see [mobile-auth.md](mobile-auth.md) |
| `platform/storage/` | hydration, sync reads, async writes | **live** — web/Tauri use `webStorage` (localStorage); Capacitor uses `capacitorStorage` (Preferences). Selected by the `@storage-impl` build alias, see [storage.md](storage.md) |
| `platform/lifecycle/` | app-background flush implementation | **live** — `webLifecycle` (`pagehide`) for web/Tauri, `capacitorLifecycle` (`@capacitor/app`) for Capacitor; surfaced through `platform.js`, selected by `@lifecycle-impl` |

Each selection folds away at build time — the native bundle contains no web
implementation and vice versa, verified per chunk rather than assumed.

All four platform boundaries now select their implementation with a build alias
(`@auth-impl`, `@storage-impl`, `@lifecycle-impl`, `@links-impl`, all in
`vite.config.js`), for one reason: each has a native branch that pulls in a
plugin — `@capacitor-firebase/authentication`, `@capacitor/preferences`,
`@capacitor/app`, and (Phase 4) `@capacitor/browser` — whose module calls
`registerPlugin()` at import time, a side effect a static import cannot be
tree-shaken past. A source-level `isCapacitor ? … : …` would drag that plugin
into every bundle even folded to a constant; an alias means only the selected
file enters the module graph, so the plugin is absent from the bundles that do
not select it — verified per bundle.

`platform/links` was the last to convert, and it sharpens the rule. Through
Phase 3 it used a source-level `isTauri ? …` because its only native branch (the
Tauri opener) is side-effect-free and tree-shook cleanly. Phase 4 added a
Capacitor branch that imports `@capacitor/browser`, which does *not* tree-shake,
so the **implementation selection** moved to `@links-impl` (a three-way alias:
`webLinks` / `tauriLinks` / `capacitorLinks` — `nativeLinks.js` was renamed to
`tauriLinks.js` since it is no longer the generic native impl). But links also
carries a **side-effect-free sub-decision** — whether an external-link anchor
gets a click handler that routes through `openExternal` — and that stays an
in-source `isWeb` branch, because attaching an `onClick` pulls in no plugin.

So the refined rule: **a plugin-importing selection uses an alias; a
side-effect-free decision uses an in-source branch — even when both live inside
the same boundary.** Auth was also the boundary whose desktop swap turned out to
be unnecessary (Tauri reuses the popup) — but mobile *does* differ, exactly as
the boundary anticipated, so the native branch the Tauri work removed is now
reintroduced for Capacitor. See [mobile-auth.md](mobile-auth.md) and
[storage.md](storage.md).

### What is intentionally deferred

| Not built | Why |
| --- | --- |
| `platform/dialogs.js` | zero call sites. `window.confirm` was replaced by the React `ConfirmDialog` precisely because blocking dialogs misbehave in webviews |
| `platform/audio/` | Web Audio is identical in every webview; the tuner and metronome share no code beyond the name `AudioContext` |
| `platform/microphone.js` | boundary is documented in `useTuner.js`, but Capacitor needs a pre-request while Tauri needs an OS entitlement — the interface cannot be designed without a shell to test |
| `desktopAuth.js` | desktop turned out not to need one — Tauri reuses the popup flow. (`mobileAuth.js` is now **built** — Capacitor's native Google Sign-In, see [mobile-auth.md](mobile-auth.md).) |
| `platform/window.js` | window geometry and single-instance are desktop concepts the OS owns everywhere else. Wrapping them would produce functions that no-op on every other target. Both live in the Tauri shell instead — see [desktop-polish.md](desktop-polish.md) |

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
