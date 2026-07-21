# Platform Roadmap

Migration plan toward Tauri (desktop) and Capacitor (mobile).

**Status: Phase 2 complete. Phase 3 started — Tauri proof of concept only.**

A minimal Tauri shell builds and launches against `dist-native/`; see
[tauri-poc.md](tauri-poc.md). **Capacitor is not installed**, and no migration
work (auth, storage, audio) has been done on either platform. Claims about
Capacitor in this document remain analytical; claims about Tauri are now marked
as verified or not.

---

## Phases

### Phase 1 — Cleanup and optimisation (done)

Dead code removal, a single `onAuthStateChanged` listener via `AuthProvider`,
Firestore write-result plumbing, debounced note and settings writes, self-hosted
fonts, Firestore persistent cache, and bundle work that moved the Firestore SDK
off the critical path.

### Phase 2 — Abstraction and native preparation (done)

| Work | Result |
| --- | --- |
| Build targets | `npm run build` (web) / `npm run build:native`; one Vite config branching on `--mode native` |
| Environment detection | `platform/platform.js`; no feature touches `navigator`/`matchMedia` |
| External links | `platform/links.js`; native click interception already wired |
| Authentication | `platform/auth/`; popup isolated from `AuthProvider` |
| Storage | `platform/storage/`; async-capable driver contract, sync feature reads |
| Audio lifecycle | tuner gated behind an explicit START; suspended-context detection |
| Audits | native compatibility sweep, YouTube embed audit |

### Phase 3 — Native integration (in progress)

| Step | Status |
| --- | --- |
| Tauri shell builds + launches from `dist-native/` | **done** — [tauri-poc.md](tauri-poc.md) |
| Platform detection correct in the native binary | **done** — verified by dead-code elimination |
| Firebase initialises inside WebView2 | **done** — Auth + heartbeat IndexedDB created |
| Auth boundary fails loudly on native | **done** — `AuthNotImplementedError` shipped, web popup absent |
| Native authentication | **investigated, not implemented** — [tauri-auth-investigation.md](tauri-auth-investigation.md) |
| Native storage driver | not started |
| Native links implementation | not started |
| Microphone / audio on native | not started |
| Capacitor shell | not started |

Ordered by risk. Authentication first: everything signed-in depends on it, and
it is the only item that can block the whole effort.

#### Issues discovered by the PoC

1. **`tauri dev` ran the app in web mode.** `devUrl` serves the Vite dev
   server, and the scaffold's `beforeDevCommand` used the default web mode — so
   `isNative` read `false` and dev exercised the wrong branches entirely. Fixed
   by passing `--mode native`.
2. **The dev port must be pinned.** Vite silently auto-increments when a port
   is taken, leaving `devUrl` aimed at another server. Both ends pinned with
   `--strictPort`.
3. **The origin is `http://tauri.localhost`, not `tauri://localhost`.** Earlier
   audits assumed a custom scheme, which drove the pessimistic Firebase and
   YouTube forecasts. An http origin with a real hostname is friendlier to
   both — those risks need re-testing rather than being taken as settled.
4. **Windows toolchain ordering.** The Windows SDK `Lib` directory appears
   before the install completes; building then fails on `dbghelp.lib`. Wait for
   the installer to exit.
5. **ESLint breaks after the first Tauri build.** Tauri's codegen assets are
   compressed blobs with a `.js` extension, and flat config does not read
   nested `.gitignore`. Fixed by ignoring `src-tauri/target` and
   `src-tauri/gen` — the only application-repo change the PoC required.

---

## Build targets

| | web (default) | native |
| --- | --- | --- |
| Command | `npm run build` | `npm run build:native` |
| Mode | `production` | `native` |
| Output | `dist/` | `dist-native/` |
| Base | `/` on Vercel, else `/guitar-bass-hub/` | `./` |
| PWA / service worker | enabled | plugin not applied |

Separate output directories are deliberate: `npm run deploy` reads `dist/`, so
a native build can never be published to the web by accident.

**Cheap pre-flight, no toolchain needed:** build native, open
`dist-native/index.html` from `file://`. If it runs, the relative-base and
service-worker assumptions are confirmed before installing anything.

---

## Expected work per area

### Authentication — highest risk, do first

Today: `signInWithPopup` in `platform/auth/webAuth.js`.

Popup needs a second window plus cross-origin `postMessage` back to the
Firebase `authDomain`. **Neither wrapper can do this.**

**Investigated for Tauri — see
[tauri-auth-investigation.md](tauri-auth-investigation.md).** Summary:

The `http://tauri.localhost` origin is confirmed, and it *is* friendlier than
the custom scheme earlier audits assumed. But reusing the popup flow needs
three independent gates to pass, and the first already fails: **wry suppresses
`window.open()` unless the app registers an `on_new_window` handler**, so
`signInWithPopup` would fail with `auth/popup-blocked`. That is fixable. The
harder unknown is whether Google's OAuth consent screen accepts WebView2 at
all, since embedded user agents are blocked by policy.

Current lean is **Option B** (system-browser OAuth + `signInWithCredential`) —
not because popup reuse is impossible, but because its remaining risk sits with
a third-party policy that could break every installed desktop client at once.
**Not a final decision**: two cheap experiments are listed in the investigation
doc that would settle it either way.

Capacitor's `capacitor://localhost` remains a custom scheme unless
`iosScheme: 'https'` is set, so mobile may need its own answer regardless.

- **Capacitor** — native Google Sign-In returns an `idToken` →
  `GoogleAuthProvider.credential(idToken)` → `signInWithCredential()`.
- **Tauri** — open Google's consent screen in the **system browser** (Google's
  OAuth policy refuses embedded webviews), catch the loopback/deep-link
  redirect, exchange the code, then `signInWithCredential()`.

Both converge on `signInWithCredential`, producing a session indistinguishable
from today's. `AuthProvider` and every consumer are unaffected — add a file and
one branch in `platform/auth/index.js`.

Note this changes the *client method*, not the security model: the same Google
identity, so rules keyed on `request.auth.uid` are untouched.

### Storage — native persistence drivers

Implement `loadAll()` / `persist()` against Capacitor Preferences or the Tauri
store and select it by build target. Features do not change. Full contract in
[storage.md](storage.md).

### Links — system browser handling

`openExternal()` swaps to `@tauri-apps/plugin-shell` `open()` or
`@capacitor/browser` `Browser.open()`. The anchor-interception half is already
wired: on a native build `externalLinkProps` attaches an `onClick` that
delegates to `openExternal`. Present in the native bundle but **never executed
against a real shell** — treat as unverified.

### Microphone — native permissions

Boundary documented in `useTuner.js`. Acquisition is already gated behind an
explicit START press, which satisfies the user-activation requirement for
`AudioContext`.

| Target | Required |
| --- | --- |
| Capacitor iOS | `NSMicrophoneUsageDescription`; explicit `requestPermissions()` **before** `getUserMedia` — implicit prompting is web-only |
| Capacitor Android | `RECORD_AUDIO` in the manifest plus a runtime request (API 23+) |
| Tauri macOS | `NSMicrophoneUsageDescription`; `com.apple.security.device.audio-input` entitlement when sandboxed |
| Tauri Windows | WebView2 inherits the OS microphone privacy setting |
| Tauri Linux | WebKitGTK permission handling varies — verify early, least predictable target |

### Audio — interruption and background decisions

**Product decisions, not yet made.** Two known gaps, both deliberately
unimplemented:

- **Interruption.** No `statechange` listener on the metronome's
  `AudioContext`. If the OS suspends it (phone call, another app taking audio
  focus) the UI keeps showing RUNNING with no sound. Recovery today needs a
  STOP→START toggle. Implementing detection requires a policy: auto-resume,
  surface a banner, or stop.
- **Background playback.** The scheduler is a 25 ms `setInterval` against a
  100 ms horizon; background tabs throttle to ≥1 s and mobile suspends JS
  entirely, so audio stops shortly after backgrounding. Running with the screen
  off needs the iOS `audio` background mode and an Android foreground service —
  and a decision about whether that is wanted at all.

### YouTube embeds

Audited separately; no code changes were required. See
[youtube-native-compatibility.md](youtube-native-compatibility.md).

---

## Before installing anything

1. **Decide the auth flow.** Everything else is reversible; this shapes the
   integration.
2. **Run the `file://` pre-flight** above.
3. **Spike the tuner and one YouTube embed early** — the two features most
   likely to fail outright rather than degrade.
4. **Design nothing speculatively.** Each deferred abstraction in
   [architecture.md](architecture.md) has a recorded trigger; wait for it.
