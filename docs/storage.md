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

## Future native drivers

A driver implements three things and nothing else:

```js
export const KEY_PREFIX = "practice-hub:";
export async function loadAll()           { /* -> [[key, value], ...] */ }
export async function persist(key, value) { /* void */ }
```

| Target | `loadAll` | `persist` |
| --- | --- | --- |
| Web (today) | iterate `localStorage`, filter by prefix | `localStorage.setItem` |
| Capacitor | `Preferences.keys()` then `Preferences.get()` per key | `Preferences.set()` |
| Tauri | `store.entries()` | `store.set()` then `store.save()` |

`src/platform/storage/index.js` selects the driver by build target, exactly as
`platform/auth` does.

**Features do not change when the driver changes.** Not the storage API, not
the four feature modules, not a single `useState` initialiser. That is the
whole point of hydrating up front.

The cost lands where it should: on native, `loadAll()` takes real milliseconds
and delays first paint by that much. That is the correct trade — the
alternative is a visible flash of defaults on every launch.

## Durability note for native

On mobile the OS can evict webview storage under pressure. Most keys survive
that fine because Firestore holds the authoritative copy (see
[data-model.md](data-model.md)), but **signed-out metronome presets exist
nowhere else**. That is the one key with genuine data-loss exposure once
packaged, and it is worth deciding deliberately whether to accept it.
