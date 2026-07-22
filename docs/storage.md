# Storage

Device-local persistence. For what lives in Firestore instead, see
[data-model.md](data-model.md).

---

## The problem this solves

Three call sites read storage to seed React's **initial** state:

```text
Metronome.jsx          useState(loadMetronomeSettings)
MetronomePresets.jsx   useState(() => listPresets())
useSortPreference.js   useState(() => readLocal(instrument))
```

They need an answer during the first render. `localStorage` can give one.
Capacitor Preferences and the Tauri store cannot — both are async.

The tempting fix is a `storage.get(key)` that looks synchronous and wraps an
async store underneath. **This was explicitly rejected.** Such a wrapper has to
return stale or empty data on first read, so the metronome would paint at
120/4 defaults and then snap to the stored setup. A visible flash — a
behaviour regression dressed up as an abstraction, and one that would only
appear on the platform hardest to debug.

## The shape that avoids it

Move the asynchrony to **startup** instead of to the call sites.

```text
main.jsx
  hydrateStorage()  --async-->  driver.loadAll()  -->  in-memory Map
        |
        +-- resolves --> ReactDOM.createRoot(...).render(<App/>)

runtime
  readItem(key)    -- synchronous --> Map        (no I/O, cannot throw)
  writeItem(k, v)  -- synchronous --> Map        (immediately readable)
                   +- fire & forget -> driver.persist()
```

Three properties follow:

- **Reads are synchronous because they come from memory**, not from storage.
  Nothing pretends.
- **Writes update the cache synchronously**, so a read immediately after a
  write is correct; persistence happens in the background and never blocks.
- **The driver is the only async part**, and the only thing a platform
  replaces.

No loading gate or provider is needed. Nothing renders until the cache is
populated, which is strictly stronger than gating — defaults cannot appear and
then be replaced, because there is no render in which they could.

## API

Three functions, in `src/platform/storage/`.

| Function | Contract |
| --- | --- |
| `hydrateStorage()` | async, idempotent, **never rejects**. Call once before render |
| `readItem(key)` | synchronous. Returns `null` when absent — deliberately matching `localStorage.getItem`, so existing `if (!raw)` checks still hold |
| `writeItem(key, value)` | synchronous cache update, background persist. Never throws |

Values are strings. Callers keep their own `JSON.parse`/`stringify` and
validation, which is why migrating 13 call sites was a mechanical substitution
rather than a rewrite.

There is deliberately **no `removeItem`**: nothing in the app deletes a key
(preset deletion rewrites the whole list). Adding one would be an unused code
path.

## Failure behaviour

Storage is not guaranteed. Private mode, disabled storage and quota limits are
all normal.

- `hydrateStorage()` never rejects. If storage is unreadable the app starts on
  defaults rather than failing to render at all — a white screen would be a
  far worse outcome than lost preferences.
- `writeItem` never throws. The driver logs the failure; the value stays in the
  in-memory cache, so the **session** behaves correctly and only durability is
  lost.
- Reading before hydration logs a one-time warning. It signals a startup
  ordering bug, which would otherwise silently serve defaults and then
  overwrite real data on the next write.

## Namespacing

Every key is prefixed `practice-hub:`. Hydration **enumerates by prefix**
rather than reading a fixed list, because per-account keys are dynamic
(`...:{uid}`).

This matters for driver portability: both Capacitor (`Preferences.keys()`) and
the Tauri store (`store.entries()`) support enumeration, so `loadAll()` is
implementable on both. That was checked before committing to the design.

`writeItem` warns on an un-prefixed key — such a value would not be picked up
by the next hydration and would silently vanish on reload.

## Drivers

A driver implements three things and nothing else:

```js
export const KEY_PREFIX = "practice-hub:";
export async function loadAll()           { /* -> [[key, value], ...] */ }
export async function persist(key, value) { /* void */ }
```

| Target | `loadAll` | `persist` | Status |
| --- | --- | --- | --- |
| Web + Tauri | iterate `localStorage`, filter by prefix | `localStorage.setItem` | `webStorage.js` — live |
| Capacitor | `Preferences.keys()` then `Preferences.get()` per key | `Preferences.set()` | `capacitorStorage.js` — live |
| Tauri (dedicated) | `store.entries()` | `store.set()` then `store.save()` | not needed — desktop reuses `webStorage` |

Values are raw strings and keys keep the `practice-hub:` prefix on every driver,
so the serialization is identical target to target — the same bytes the callers'
`JSON.parse`/`stringify` already produce. The Capacitor Preferences web fallback
namespaces its own store (`CapacitorStorage.<key>` in `localStorage`) and strips
that group in `keys()`, so the prefix filter still sees `practice-hub:…`; on a
device the native store holds the raw key.

### Selection is a build alias, not a source-level branch

`src/platform/storage/index.js` imports its driver from `@storage-impl`, a **Vite
`resolve.alias`** that resolves to `webStorage.js` (web/Tauri) or
`capacitorStorage.js` (Capacitor) at build time (see `vite.config.js`).

This is deliberately an alias rather than the source-level `isCapacitor ? … : …`
that `platform/links` uses. `@capacitor/preferences` calls `registerPlugin()` at
import time — a side effect a static import cannot be tree-shaken past — so an
in-source branch would drag the plugin into the web and Tauri bundles even with
the branch folded to a constant. An alias means only the selected driver ever
enters the module graph. This is exactly the reasoning `platform/auth` uses for
`@auth-impl`; the plugin-side-effect boundaries (`auth`, `storage`, `lifecycle`)
all take the alias, while side-effect-free `links` keeps the in-source branch.
Verified per bundle: web/Tauri carry **zero** `@capacitor/preferences`; only the
Capacitor bundle does.

**Features do not change when the driver changes.** Not the storage API, not
the feature modules, not a single `useState` initialiser. That is the whole
point of hydrating up front. The metronome preset **migration bridge**
(signed-out presets → first sign-in → cloud) runs entirely through
`readItem`/`writeItem`, so it is driver-agnostic and works unchanged on
Capacitor. A packaged mobile app is a fresh install with an empty Preferences
store — it does not read the web app's `localStorage`, so there is no
cross-driver data migration to perform.

The cost lands where it should: on Capacitor, `loadAll()` is a handful of real
async reads and delays first paint by that much. That is the correct trade — the
alternative is a visible flash of defaults on every launch, which is why the
whole layer hydrates before React mounts.

## Why Preferences (and the durability note)

A mobile webview *does* expose `localStorage`, so the web driver would "work" on
Capacitor. It was **not** reused, for one reason: the OS can evict webview
storage (the bucket `localStorage` lives in) under storage pressure, silently.
Most keys survive that fine because Firestore holds the authoritative copy (see
[data-model.md](data-model.md)) — but **signed-out metronome presets exist
nowhere else**, so on the web-storage bucket they are the one key with genuine
data-loss exposure once packaged.

Capacitor **Preferences** is backed by the platform's native key/value store
(`UserDefaults` on iOS, `SharedPreferences` on Android), which is *not* part of
the evictable web-storage bucket — it persists like any other native app data,
cleared only on uninstall or an explicit user "clear data". Choosing it is what
removes that exposure, so the durability concern that applied to a naive
localStorage port does not apply here.

**Remaining device-only unknowns** (cannot be exercised without a build rig):
the native Preferences round-trip and its durability across relaunch/low-memory
kill, and the exact latency `loadAll()` adds to first paint on real hardware.
Verified here through the plugin's web fallback: hydration reads a seeded value
before first paint (no flash of defaults) and the write path lands in the
Preferences store — see [platform-roadmap.md](platform-roadmap.md).
