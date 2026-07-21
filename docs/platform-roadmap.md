# Platform Roadmap

Migration plan toward Tauri (desktop) and Capacitor (mobile).

**Status: Phase 2 complete. Phase 3 not started.** Neither Tauri nor Capacitor
is installed. Nothing in Phase 3 has been tested against a real shell — every
native claim in this document is analytical until a spike proves otherwise.

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

### Phase 3 — Native integration (not started)

Ordered by risk. Authentication first: everything signed-in depends on it, and
it is the only item that can block the whole effort.

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
Firebase `authDomain`. **Neither wrapper can do this**, and custom schemes
(`tauri://localhost`, `capacitor://localhost`) cannot be registered as Firebase
authorised domains.

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
