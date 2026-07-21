# Data Model

Where data lives, who owns it, and what happens to it when the app is packaged.
Mechanics of the local cache are in [storage.md](storage.md).

---

## Ownership

Everything a signed-in user owns lives under their own document tree. **There
is no shared or public collection**, and no document is readable across
accounts.

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

`firebase/userCollection.js` builds the CRUD surface for all three
subcollections from one implementation, including a per-collection allowlist of
writable fields. Writes never throw — they resolve to `{ ok: true, ... }` or
`{ ok: false, code, message }` so callers can report failures instead of losing
data silently.

## Identity

`uid` comes from Firebase Authentication (Google sign-in) and is the only key
into user data. There is no separate profile or user record — the auth identity
*is* the account.

Two consequences worth holding onto:

- **Every path is derived from `request.auth.uid`.** Nothing is keyed on email
  or display name, both of which can change.
- **Changing the sign-in *method* does not change identity.** The planned
  native flows (native Google Sign-In, system-browser OAuth) both end in
  `signInWithCredential` with the same Google account, producing the same
  `uid`. Native packaging therefore has **no** effect on data ownership or
  access rules.

Signed out, the app is read-only: sample backing tracks are shown as a preview
and metronome data falls back to local-only storage.

## Local storage keys

All namespaced `practice-hub:`. Hydration enumerates by that prefix.

| Key | Contents | Authoritative copy | Survives eviction? |
| --- | --- | --- | --- |
| `practice-hub:metronome` | live setup (bpm, beats, sounds, swing, ramp, gap, random mute) | Firestore `prefs.metronome` when signed in | recoverable |
| `practice-hub:metronome-presets` | **signed-out** named presets | **none — local only** | **lost** |
| `practice-hub:metronome-presets:{uid}` | cache of cloud presets | Firestore subcollection | regenerable |
| `practice-hub:sort:{instrument}` | song sort preference | Firestore `prefs` | recoverable |
| `practice-hub:metronome-migrated:{uid}` | one-shot seed flag | — | re-seeds harmlessly |
| `practice-hub:metronome-presets-migrated:{uid}` | one-shot migration flag | — | re-migrates harmlessly |

### Dual-write pattern

Live metronome settings and sort preference are written to **both** local
storage and Firestore. Local first (instant, works offline and signed out),
Firestore as the source of truth when signed in.

`useMetronomeSettingsSync` is the reference implementation. Two mechanisms make
it safe and are easy to break if edited casually:

- A serialized snapshot of the last-known server value. A payload identical to
  it is never written and a snapshot matching it is never applied — this is
  what stops write → snapshot → apply → write looping forever.
- Uploads are gated until the first snapshot resolves, keyed by `uid`. Without
  the uid key, switching accounts pushes the previous account's setup into the
  new account's document.

Writes debounce (~800 ms settings, ~600 ms song notes) and flush on unmount and
`pagehide`.

### Cached data

`practice-hub:metronome-presets:{uid}` is a mirror so presets paint before
Firestore responds. Firestore is authoritative; the cache is never merged, only
overwritten. Firestore itself also keeps an IndexedDB cache
(`persistentLocalCache`, multi-tab), so previously loaded data renders offline
and offline writes replay on reconnect.

Firebase Auth also persists its session token in IndexedDB — relevant below.

## Migration considerations

**One-shot migrations, all uid-scoped.** Two exist: seeding cloud metronome
settings from a device that has none stored, and uploading legacy un-keyed
local presets. Both use a `...-migrated:{uid}` flag.

The uid scoping is not incidental — the presets flag was originally global,
which meant the first account to migrate on a device permanently blocked
migration for every other account. Any future migration flag must be
uid-scoped.

**Native durability.** Mobile OSes evict webview storage under pressure. Most
keys above are recoverable from Firestore, but two things are not:

- **Signed-out metronome presets** are user-authored and exist nowhere else.
  This is the only genuine data-loss exposure once packaged.
- **The Firebase Auth token** lives in IndexedDB; eviction signs the user out.
  Recoverable, but it will look like a bug.

**Field allowlists.** Each collection declares `allowedFields`. Adding a field
to the UI without adding it there means writes silently drop it — check the
allowlist first when a new field "doesn't save".

**Rules.** Not stored in this repo. The client only ever reads and writes under
`users/{uid}`, so a rule set restricting access to `request.auth.uid` satisfies
everything described here. No native work planned changes that.
