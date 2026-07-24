# Platform Roadmap

Migration plan toward Tauri (desktop) and Capacitor (mobile).

**Status: Phase 2 complete. Phase 3 in progress — Tauri shell built,
authentication implemented, first desktop polish pass done.**

A minimal Tauri shell builds and launches against `dist-native/`; see
[tauri-poc.md](tauri-poc.md). Desktop sign-in now uses the same Firebase popup
flow as the web build, with the shell allowing that one popup URL; see
[tauri-auth-investigation.md](tauri-auth-investigation.md), verified end to end
including persistence across a restart. External links,
window behaviour and dialog focus have had a desktop pass — see
[desktop-polish.md](desktop-polish.md). Audio is untouched on native.

**Capacitor is installed** (three-target build in place): native authentication
(Phase 2) and persistence + lifecycle (Phase 3) are implemented and verified as
far as this environment allows — lint, all three builds, per-bundle isolation and
a browser-fallback boot/round-trip. On-device claims (native OAuth, native
Preferences durability, real backgrounding) still need a build rig and are marked
as such throughout. Claims about Tauri are marked as verified or not.

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
| External links | `platform/links/`; native click interception already wired |
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
| Native authentication | **implemented** — popup allow-list in the shell, `webAuth` on both targets |
| Sign-in, persistence, sign-out | **verified end to end** in the release build |
| YouTube embeds on Windows | **verified** — all four surfaces load and play |
| Native links implementation | **done (both shells)** — Tauri opener (`tauriLinks.js`) and Capacitor `@capacitor/browser` (`capacitorLinks.js`), selected by the `@links-impl` alias; [desktop-polish.md](desktop-polish.md) |
| Desktop window behaviour | **done** — geometry persistence, centred first launch, single instance, 720×560 minimum |
| Distribution prep | **done, unsigned** — real icons, CSP, narrowed capabilities, NSIS installer; see [release.md](release.md) |
| Code signing + updater | not started — the two blockers for public distribution |
| Native storage driver | **done (Capacitor)** — `capacitorStorage.js` (Preferences) behind the existing contract, via the `@storage-impl` alias; Tauri reuses `webStorage`, so no dedicated desktop driver is needed. See [storage.md](storage.md) |
| App-background flush on Capacitor | **done** — `subscribeToAppBackground` re-exports the `@lifecycle-impl` alias; Capacitor uses `@capacitor/app` `appStateChange`, web/Tauri keep `pagehide` |
| Microphone boundary + permissions | **done (Phase 5)** — `platform/microphone/` (`requestPermission`/`acquireStream`/`stopStream`); compile-time boolean (no plugin); `RECORD_AUDIO` + `NSMicrophoneUsageDescription` added. Device-only: the native OS prompt itself. Audio interruption/background stays deferred below |
| Capacitor shell | **in progress** — Phase 1 (shell + three-target build) done; Phase 2 native auth done (`mobileAuth`, `@auth-impl` alias, [mobile-auth.md](mobile-auth.md)); Phase 3 persistence + lifecycle done (`@storage-impl`, `@lifecycle-impl`); Phase 4 external links done (`capacitorLinks`, `@links-impl` alias); Phase 5 microphone boundary done (`platform/microphone/`, compile-time boolean); Phase 6 YouTube compatibility done (universal `WatchOnYouTube` fallback via `platform/links`; native config inspected, none required — [youtube-native-compatibility.md](youtube-native-compatibility.md)); Phase 7 mobile-shell polish done (status-bar theming via new `@nativeui-impl` alias + `@capacitor/status-bar`; keyboard resize + splash/webview dark background via native config; `@capacitor/keyboard` native-only — [mobile-readiness-audit.md](mobile-readiness-audit.md)); Phase 8 mobile-experience done (audio-interruption detection + RESUME recovery and screen wake lock for the tuner/metronome via shared `src/hooks/`; standard web APIs, **no plugin** — see the Audio section below) |

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

**Cheap pre-flight, no toolchain needed:** build native, then serve it over
HTTP with `npm run preview:native` and open it in a browser. **Do not open
`dist-native/index.html` from `file://`** — Vite emits the entry as
`<script type="module" crossorigin>` (and a `crossorigin` stylesheet), and a
browser blocks both from a `file://` document (`origin 'null'`) under the module
CORS rules, so the app never mounts and `#root` stays empty regardless of
correctness. Verified in the Capacitor Phase 0 investigation: the console shows
`… blocked by CORS policy: Cross origin requests are only supported for protocol
schemes: … http, https …`. Tauri and Capacitor both serve from an http(s)-style
origin (`http://tauri.localhost`, `https://localhost`), which `preview:native`
reproduces and `file://` does not. If it runs there, the relative-base and
service-worker assumptions are confirmed before installing anything.
(`preview:native` serves under the web base path; the native build's relative
`./assets/` URLs resolve against whatever mount point, which is the whole point
of `base: './'`.)

---

## Expected work per area

### Authentication — done for desktop

Web, PWA and Tauri all use `signInWithPopup` in `platform/auth/webAuth.js`.
`platform/auth/index.js` no longer branches: the popup was the one thing a
packaged webview was assumed not to do, and it works.

**Implemented after experimental validation — see
[tauri-auth-investigation.md](tauri-auth-investigation.md).** Why it works:

1. `window.open` works once an `on_new_window` handler returns `Allow`. The
   default shell registers none, which is why it silently failed before.
2. `tauri.localhost` is **already authorised** — Firebase matches subdomains
   against the existing `localhost` entry. **No Console change needed.**
3. Google accepted WebView2; no `disallowed_useragent`. The popup is a real
   browser window with a visible address bar, which is what that policy exists
   to protect.

The shell allows exactly `https://<host>.firebaseapp.com/__/auth/handler` and
denies every other `window.open`. An unrestricted bridge would give embedded
third-party content — YouTube most obviously — an in-app browser window; the
auth handler is the only URL the app needs opened that way.

Verified end to end in the release build: sign-in, identity in the header,
Firestore-backed features, session persistence across a restart, sign-out, and
sign-in again. Note that signing out of Firebase leaves Google's own session in
the WebView2 profile, so the next sign-in needs no password.

This supersedes the earlier lean toward Option B, which had assumed gates 2 and
3 were likely to fail. Option B remains the documented fallback; because the
platform layer isolates credential acquisition, switching to it later would be
a one-file change.

Capacitor's `capacitor://localhost` remains a custom scheme unless
`iosScheme: 'https'` is set, so mobile needs its own answer regardless — and
adding a mobile target must reintroduce the native branch that desktop no
longer needs, or mobile will silently inherit a flow that cannot work there.

**Fallback plan (Option B), still valid if popup reuse is ever ruled out:**

- **Capacitor** — native Google Sign-In returns an `idToken` →
  `GoogleAuthProvider.credential(idToken)` → `signInWithCredential()`. Likely
  required regardless, since `capacitor://localhost` fails the same protocol
  guard that `tauri://localhost` fails.
- **Tauri** — open Google's consent screen in the system browser, catch the
  loopback redirect, exchange the code, then `signInWithCredential()`. Needs a
  desktop OAuth client and its ID allow-listed in the Google provider's Web SDK
  configuration.

Both converge on `signInWithCredential`, producing a session indistinguishable
from today's. `AuthProvider` and every consumer are unaffected — add a file and
one branch in `platform/auth/index.js`.

Note this changes the *client method*, not the security model: the same Google
identity, so rules keyed on `request.auth.uid` are untouched.

### Storage — native persistence drivers

**Done for Capacitor.** `platform/storage/capacitorStorage.js` implements
`loadAll()` (`Preferences.keys()` → `Preferences.get()` per key) and `persist()`
(`Preferences.set()`) against Capacitor **Preferences**, chosen over reusing
`localStorage` because Preferences is backed by the native key/value store and is
not part of the evictable web-storage bucket. It is selected by the
`@storage-impl` **build alias** — not a source-level branch — because
`@capacitor/preferences` registers a plugin at import time; the same reasoning as
`@auth-impl`. Features, the migration bridge and every `useState` initialiser are
unchanged. Tauri reuses `webStorage` (localStorage in WebView2), so no dedicated
desktop driver is needed. Full contract and the "why Preferences" note in
[storage.md](storage.md).

Verified here through the plugin's web fallback: a cold reload hydrates a seeded
metronome BPM before first paint (no flash of defaults) and the write path lands
in the Preferences store, with zero console errors. Native Preferences durability
across a low-memory kill is the device-only unknown.

### Links — system browser handling

**Done for both shells.** Tauri's `platform/links/tauriLinks.js` calls
`@tauri-apps/plugin-opener` `openUrl(url)` (verified end to end — clicking a tool
card opens the system browser on the right page and creates no in-app window);
Capacitor's `platform/links/capacitorLinks.js` (Phase 4) calls `@capacitor/browser`
`Browser.open({ url })`, which presents the OS in-app browser (SFSafariViewController
/ Custom Tabs) over the app.

The implementation is chosen by the `@links-impl` Vite alias — a three-way select
across `webLinks` / `tauriLinks` / `capacitorLinks`. It moved from the old
source-level `isTauri ? …` because `@capacitor/browser` calls `registerPlugin()`
at import time (confirmed by reading its ESM entry), a side effect a static import
cannot be tree-shaken past; an alias keeps that plugin out of the web and Tauri
bundles, and keeps `@tauri-apps/plugin-opener` out of the Capacitor bundle —
verified per bundle. `nativeLinks.js` was renamed to `tauriLinks.js` since it is
no longer the generic native impl.

URL validation, anchor attributes and click interception stayed in the shared
`index.js` rather than being duplicated per platform. The one part that is *not*
aliased is the interception decision itself — whether `externalLinkProps` attaches
a click handler — which stays an in-source `isWeb` branch (now covering both
packaged shells, not just Tauri) because attaching an `onClick` imports no plugin.
`openExternal` is async because that is the contract every shell can meet. See
[desktop-polish.md](desktop-polish.md).

### Microphone — native permissions

**Boundary built in Phase 5.** `src/platform/microphone/` owns acquisition and
permission (`requestPermission` / `acquireStream` / `stopStream`); `useTuner`
consumes it and no longer touches `navigator.mediaDevices` for the stream.
Acquisition is still gated behind the explicit START press, which satisfies the
user-activation requirement for `AudioContext`.

**Why a compile-time boolean, not a `@…-impl` alias.** Unlike auth/storage/
lifecycle/links, the Capacitor implementation imports no plugin. A tuner needs a
live `MediaStream`, which only the WebView's own `getUserMedia` provides — there
is no first-party `@capacitor/microphone` (verified: the package 404s), and the
community recorders capture to a file, not a stream (their ESM *does* call
`registerPlugin()`, so using one would have forced an alias — but a recorder is
the wrong tool). So acquisition is the same `getUserMedia` on every target, and
the native OS permission is delivered by Capacitor's WebView bridge from static
config, not a JS import. With no `registerPlugin()` side effect, a source-level
`isCapacitor ? …` boolean is correct and an alias would be pure ceremony.

**Native config performed** (persists across `cap sync` — it does not overwrite
these):

| Target | Required | Status |
| --- | --- | --- |
| Capacitor Android | `RECORD_AUDIO` in the manifest; Capacitor's `onPermissionRequest` turns the tuner's `getUserMedia` into the runtime prompt (API 23+) | **added** to `AndroidManifest.xml` |
| Capacitor iOS | `NSMicrophoneUsageDescription`; WKWebView prompts natively on `getUserMedia` | **added** to `Info.plist` |
| Tauri Windows | WebView2 inherits the OS microphone privacy setting | no change needed |
| Tauri macOS | `NSMicrophoneUsageDescription` + `com.apple.security.device.audio-input` entitlement when sandboxed | deferred to a macOS build |
| Tauri Linux | WebKitGTK permission handling varies — verify early, least predictable target | deferred to a Linux build |

**Permission-flow correction (post-Phase 5, real-device fix).** The first cut of
`capacitorMicrophone.requestPermission()` used `navigator.permissions.query({ name:
"microphone" })` to detect a hard denial up front. On a real Android device this
returned `"denied"` even with `RECORD_AUDIO` granted, so `useTuner` threw before
`acquireStream()` and `getUserMedia()` never ran — while the PWA on the same device
worked. Android System WebView exposes the Permissions API but does not back it
with a persistent capture-permission grant; permission is decided per request by
Capacitor's `onPermissionRequest` bridge when `getUserMedia()` runs. Fix:
`requestPermission()` now returns `"prompt"` on Capacitor (identical to web), and
`getUserMedia()` is the sole authoritative permission request on every target. A
genuine refusal still comes back as `getUserMedia()`'s `NotAllowedError` through the
existing mapping. No interface, plugin, or bundle-isolation change.

**Device-only unknowns** (cannot be exercised without a build rig): the Android
runtime `RECORD_AUDIO` dialog and iOS mic prompt actually appearing, and whether
Capacitor's WebView bridge grants `getUserMedia` once permission is held. The full
acquire / error-mapping paths were verified in a browser via CDP (see the
deliverable).

### Audio — interruption handling (Phase 8, done) and background (deferred)

- **Interruption — done (Phase 8).** Both the tuner and the metronome now watch
  their `AudioContext`'s `statechange`. When the OS suspends it (incoming call,
  alarm, another app taking audio focus, a route change — WebKit reports state
  `interrupted`, Chromium `suspended`) each surfaces an amber banner explaining
  the audio was paused and offers a user-gesture **RESUME** that calls
  `ctx.resume()`. The shared `useAudioInterruption` hook (`src/hooks/`) owns the
  detection; it is pure Web Audio, identical on every target, so it needs no
  plugin. The chosen policy is **surface-and-recover**, not silent auto-resume:
  iOS will not resume a context outside a user gesture, and a visible RESUME is
  honest about what happened. The metronome re-anchors its scheduler on recovery
  (a no-op unless the clock jumped) so there is no burst of catch-up beats.
- **Wake Lock — done (Phase 8).** `useWakeLock` (`src/hooks/`) holds a
  `navigator.wakeLock('screen')` while the tuner is live or the metronome runs,
  and releases it the instant either stops. It is a feature-detected web API
  (Android WebView / WebView2 / iOS WKWebView 16.4+), re-acquired on
  `visibilitychange`; where unsupported it degrades to a no-op and the tool shows
  a "screen may sleep" note. No native keep-awake plugin was added — the web API
  covers every target, verified via CDP.
- **Background playback — still deferred (out of Phase 8 scope).** The scheduler
  is a 25 ms `setInterval` against a 100 ms horizon; background tabs throttle to
  ≥1 s and mobile suspends JS entirely, so audio stops shortly after
  backgrounding. Running with the screen off needs the iOS `audio` background
  mode and an Android foreground service — explicitly excluded from Phase 8 and
  still a product decision.

### YouTube embeds — verified on Tauri; fallback built for Capacitor (Phase 6)

Audited in Phase 2, measured in the running desktop app, then completed for
Capacitor in Phase 6. See
[youtube-native-compatibility.md](youtube-native-compatibility.md).

The audit's highest-ranked risk — that a native origin would make YouTube refuse
to play — does not apply to Tauri: `http://tauri.localhost` is an ordinary http
origin, the referrer is sent, and playback, fullscreen and repeat navigation all
work. No CSP is set, so nothing is blocked. Edge Tracking Prevention partitions
the embed's storage, which costs only playback-position persistence.

All four Tauri surfaces — song cards, setlist, backing tracks and blog — load and
play. Two things it turned up that are not compatibility problems: four of the
five sample backing-track video IDs have rotted (identical failures from a plain
web origin — stale data, not native), and "Watch on YouTube" was dead on desktop
until `openExternal` got its native implementation (now live via `capacitorLinks`
/ the opener).

**Capacitor Phase 6 (done).** The native WebView config was inspected rather than
assumed: on Capacitor 8.4.2, iOS inline playback is already a hardcoded default,
Android already serves from `https://localhost`, and `iosScheme: 'https'` is
invalid (WKWebView reserves the scheme) — so **nothing needed adding** and
`capacitor.config.json` is unchanged. The iOS `capacitor://localhost` origin risk
cannot be configured away, so the always-visible **"Open on YouTube"** fallback
(`WatchOnYouTube`, routed through `platform/links`, using a new `youtubeWatchUrl`
helper) is built on all four surfaces. Embed-failure detection is impossible
(cross-origin iframe, no `onError`), which is why the fallback is always present.
Verified via CDP on the served build (fallback renders + routes through
`@capacitor/browser`, zero console errors, isolation unregressed); real on-device
playback from the iOS origin remains the device-only unknown.

---

## Before adding the next shell

Tauri is installed and its auth flow is decided. Two mobile-prep sweeps are done
on the shared app:

- **Browser assumptions (JS/API)** —
  [browser-assumptions-audit.md](browser-assumptions-audit.md). Found the app
  already close to platform-clean: added one boundary (`subscribeToAppBackground`,
  because `pagehide` does not fire when a mobile OS backgrounds an app) and
  confirmed none of the usual porting-friction APIs are used (clipboard, share,
  file I/O, notifications, drag-and-drop, wake lock).
- **UX / layout / touch** —
  [mobile-readiness-audit.md](mobile-readiness-audit.md). The responsive base was
  sound; fixed the device-frame gaps it ignored — safe-area insets, `dvh`
  heights, iOS input-zoom, 44px touch targets, modal overflow — all as
  touch-scoped CSS that is inert on desktop. Verified with a CDP overflow sweep
  across 5 mobile viewports. The three items it deferred to the Capacitor phase —
  keyboard resize, status-bar styling and splash white-flash — were resolved in
  **Phase 7** (see that doc's "Resolved in the Capacitor phase" section); the
  sticky-hover pass remains an independent follow-up.

For Capacitor, in order:

1. ~~**Decide the auth flow.**~~ **Done and implemented (Phase 2).** Desktop's
   popup answer does not transfer — two independent blocks confirmed from current
   Google/Firebase docs: `capacitor://localhost` fails Firebase's `HTTP_REGEX`
   protocol guard, *and* Google's OAuth "secure browsers" policy blocks
   `WKWebView` and Android `WebView` with `disallowed_useragent` (`iosScheme:
   'https'` removes only the first). The production flow is native Google
   Sign-In → `signInWithCredential` in `mobileAuth.js`, selected by the
   `@auth-impl` build alias. Native OAuth config (Console, SHA fingerprints,
   `google-services.json` / `GoogleService-Info.plist`) and the on-device test
   remain to be completed on a build machine. See [mobile-auth.md](mobile-auth.md).
2. **Run the HTTP pre-flight** above (`preview:native`, never `file://`).
3. **Spike the tuner and one YouTube embed early** — the two features most
   likely to fail outright rather than degrade.
4. ~~**Point `subscribeToAppBackground` at `@capacitor/app`.**~~ **Done
   (Phase 3).** Not the predicted one-liner: the plugin's import-time
   `registerPlugin()` forced a `@lifecycle-impl` build alias
   (`capacitorLifecycle.js` → `App.addListener("appStateChange", …)`) so nothing
   leaks into the web/Tauri bundles. Without it, backgrounding the mobile app
   silently dropped the last debounced note or metronome edit.
5. ~~**Native storage driver.**~~ **Done (Phase 3)** — `capacitorStorage.js`,
   Preferences, `@storage-impl` alias (see the Storage section above).
6. **Design nothing speculatively.** Each deferred abstraction in
   [architecture.md](architecture.md) has a recorded trigger; wait for it.
