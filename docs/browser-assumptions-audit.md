# Browser Assumptions Audit

A complete sweep of `src/` for browser-only assumptions that would complicate a
future Capacitor (mobile) shell. The goal was preparation, not implementation:
make Capacitor a small integration project rather than a large refactor. **No
Capacitor code, tooling, plugin, dependency or config was added.**

This is a companion to [platform-roadmap.md](platform-roadmap.md) (what each
shell needs) and [architecture.md](architecture.md) (why the platform boundaries
are shaped the way they are). It is the record of *what was looked for and what
was found* — including the large set of APIs the app deliberately never touches.

**Result in one line:** the shared app is already close to platform-clean.
Exactly one genuine browser assumption was wrong on mobile and was fixed behind a
new boundary; everything else is already abstracted, a portable web standard, or
a boundary already documented and correctly deferred.

---

## Executive summary

| Bucket | Count | Items |
| --- | --- | --- |
| **Implemented** (new abstraction) | 2 | app-background flush (`subscribeToAppBackground`), microphone boundary (`platform/microphone/`, Phase 5) |
| **Already abstracted** | 4 | links, auth, storage, environment/connectivity |
| **Intentionally deferred** (boundary documented, needs a shell) | 0 | — microphone was the last one; built in Phase 5 |
| **No action — portable web standard** | many | Web Audio, `requestAnimationFrame`, DOM events, `fetch` of local assets, scroll/reload, URL parsing |
| **Not present at all** | — | clipboard, Web Share, file download/import, drag-and-drop, Blob/ObjectURL, FileReader, Fullscreen API, Notifications, Wake Lock, History API, cookies, geolocation, vibration |

The single most important finding: **`pagehide` does not fire when a mobile OS
backgrounds an app.** Two features debounce Firestore writes and flushed on
`pagehide`; on mobile that flush would silently never run, losing the last edit.
That is now the one new platform boundary.

---

## Method

Searched `src/` for every API on the brief and several beyond it. For each hit,
answered four questions:

1. Does it already work on desktop, and will it work unchanged under Capacitor?
2. Should it become a platform abstraction?
3. Should it intentionally stay browser-only?
4. Is no action required?

An abstraction was added **only** where the answer genuinely differs on a target
*and* there is a real call site — the same two tests the rest of `src/platform/`
already passes. Portable web standards were left alone; wrapping them would be
the "empty wrapper" the project's architecture explicitly rejects.

---

## Implemented

### App-background flush — `subscribeToAppBackground()`

| | |
| --- | --- |
| **Location** | `src/platform/platform.js` (new export); call sites `src/features/songs/useSongNotes.js`, `src/features/metronome/useMetronomeSettingsSync.js` |
| **Purpose** | Flush a debounced Firestore write before the app goes away, so a queued note or metronome-setting edit is never lost |
| **Previous implementation** | Each hook independently did `window.addEventListener("pagehide", flush)` |
| **Desktop behaviour (Tauri)** | Correct. Closing the window tears down the webview and fires `pagehide` normally — verified during the desktop lifecycle pass ([desktop-polish.md](desktop-polish.md)) |
| **Expected Capacitor behaviour** | **Broken as written.** When iOS/Android backgrounds an app (home button, app switcher, incoming call) the webview is suspended with no page transition, so `pagehide` never fires and the last debounced edit is lost. The event that fires there is `@capacitor/app` `App.addListener("pause", …)` (with `appStateChange` as the general form) |
| **Action taken** | **Yes.** Extracted the concern into `subscribeToAppBackground(callback)` in `platform.js`, alongside `subscribeToOnline` which it mirrors exactly. Both hooks now call it. The web implementation is still `pagehide`; the Capacitor swap is a one-line change in a single file, with the reason documented at the boundary |
| **Rationale** | This is the one assumption in the app that is *wrong* on mobile, not merely suboptimal — it risks silent data loss. Two call sites reached for the same event to solve the same conceptual problem ("persist before the app disappears"), which is precisely "multiple call sites for one platform-dependent concern → a single boundary." It follows the established `subscribeToOnline` precedent (a window event with a `@capacitor/network` replacement), so it adds no new pattern, only applies an existing one |

Both hooks keep their own unmount flush, which already covers in-app navigation
(leaving a song card, closing the metronome). `subscribeToAppBackground` covers
only the orthogonal case of the whole app going away while the component is still
mounted — the case that differs by platform.

> **Update (Phase 3): the Capacitor swap is now implemented.**
> `subscribeToAppBackground` re-exports a `@lifecycle-impl` build alias:
> `lifecycle/webLifecycle.js` (`pagehide`, web/Tauri) or
> `lifecycle/capacitorLifecycle.js` (`@capacitor/app` `appStateChange`,
> Capacitor). One correction to the prediction above: it was **not** a "one-line
> change in a single file." `@capacitor/app` registers a plugin at import time,
> so an inline `if (isCapacitor)` in `platform.js` would leak the plugin into the
> web/Tauri bundles — the swap had to move behind a build alias, the same shape
> `platform/auth` and `platform/storage` use. The shared hooks were untouched.
> The mobile flush fires on the foreground→background transition (before any OS
> kill), which is exactly what `pagehide` could not do.

---

## Already abstracted — no further action

These are real platform-dependent concerns that were resolved in earlier phases.
Listed for completeness; each already has exactly one file to change per target.

| Concern | Boundary | Native swap point |
| --- | --- | --- |
| Leaving the app (external links) | `platform/links/` | `tauriLinks.js` → Tauri opener; `capacitorLinks.js` → `@capacitor/browser` `Browser.open` — both live, selected by the `@links-impl` alias (Phase 4) |
| Credential acquisition | `platform/auth/` | mobile adds `mobileAuth.js` (native Google Sign-In → `signInWithCredential`) |
| Key/value persistence | `platform/storage/` | Capacitor Preferences / Tauri store; async contract already in place |
| Environment + connectivity | `platform/platform.js` | `isStandalone`, `isServiceWorkerActive`, `isOnline`, `subscribeToOnline` — Capacitor `Network`, and `platform()` widens to `ios` / `android` |

`new URL(url, window.location.href)` in `platform/links/index.js` is inside the
links boundary already; `window.location` as a resolution base is valid in every
webview. No separate action.

---

## Intentionally deferred — boundary documented, needs a shell to design

### Microphone — `navigator.mediaDevices.getUserMedia`

> **Update (Phase 5): built.** The boundary is now `src/platform/microphone/`
> (`requestPermission` / `acquireStream` / `stopStream`); `useTuner` consumes it
> and no longer touches `navigator.mediaDevices` for the stream. The row below is
> kept for the record, with the prediction it corrected.

| | |
| --- | --- |
| **Location** | `src/platform/microphone/` (acquisition + permission); `useTuner.js` keeps only the neutral `devicechange` retry |
| **Purpose** | Capture the mic stream for pitch detection |
| **Current implementation** | `navigator.mediaDevices.getUserMedia({ audio: … })` in `webMicrophone.js`, guarded for insecure-context / missing-API; `capacitorMicrophone.js` reuses it and lets `getUserMedia` be the authoritative permission request (`requestPermission` returns `"prompt"`; no Permissions-API pre-check — see the post-Phase-5 fix). Selected by a compile-time boolean |
| **Desktop behaviour** | WebView2 inherits the Windows OS microphone privacy setting; the guard already maps a blocked/absent device to a named error |
| **Prediction that was wrong** | The audit expected Capacitor to need an **explicit** `requestPermissions()` *before* `getUserMedia`. In fact there is no first-party mic plugin to call (`@capacitor/microphone` 404s) and the tuner needs a live stream a recorder plugin cannot give — so acquisition stays `getUserMedia` and the OS prompt is delivered by Capacitor's WebView bridge from `RECORD_AUDIO` / `NSMicrophoneUsageDescription`. No explicit JS request, and therefore no plugin and no build alias |
| **Action taken** | **Built (Phase 5), corrected on-device.** Compile-time boolean (no plugin); `RECORD_AUDIO` added to `AndroidManifest.xml`, `NSMicrophoneUsageDescription` to `Info.plist`. A real Android device (with mic granted) revealed the Capacitor `requestPermission` Permissions-API pre-check returned a false `"denied"` and aborted before `getUserMedia`; the pre-check was removed so `getUserMedia` is authoritative. Acquire + error-mapping paths verified via CDP; the native OS prompt / bridge grant is the device-only unknown. See [platform-roadmap.md](platform-roadmap.md) and [architecture.md](architecture.md) |

---

## No action required — portable web standards

Present in the code, but standards that behave identically across WebView2,
WKWebView (iOS) and Android System WebView. Wrapping any of these would be pure
indirection with no replacement point.

| API | Location(s) | Why no action |
| --- | --- | --- |
| **Web Audio** (`AudioContext` / `webkitAudioContext`, `decodeAudioData`, `AudioBufferSourceNode`) | `useTuner.js`, `Metronome.jsx`, `metronome/soundEngine.js` | Web Audio is a stable standard in every target webview. The `webkitAudioContext` fallback is a harmless legacy-Safari guard. The tuner and metronome share no code beyond the type name, so there is nothing to consolidate — see the `platform/audio/` row in [architecture.md](architecture.md) |
| **`requestAnimationFrame` / `cancelAnimationFrame` / `performance.now`** | `useTuner.js`, `Metronome.jsx` | Universal timing standards; identical in all webviews |
| **`fetch` of local assets** | `metronome/soundEngine.js` (WAV samples via `import.meta.env.BASE_URL`) | Relative fetch under the app origin resolves the same on `tauri.localhost`, `capacitor://localhost` and the web. `BASE_URL` is already build-target aware |
| **DOM keyboard events** (`keydown`, `focusin`) | `ConfirmDialog.jsx`, `AddSongModal.jsx`, `AddBackingTrackModal.jsx`, `Metronome.jsx`, `useDialogFocus.js` | Standard DOM events. On touch-only mobile some simply won't fire (no hardware keyboard), which degrades cleanly — the space-bar metronome shortcut is an enhancement, not the only control |
| **`window.scrollTo`** | `components/ScrollToTop.jsx` | Standard; scrolls the webview on every target |
| **`window.location.reload`** | `components/ErrorBoundary.jsx` | Reloads the webview to the app entry point on every target — valid recovery everywhere |
| **`document.getElementById`** | `main.jsx` | Standard React mount point |
| **`navigator.onLine` + `online`/`offline`** | `platform.js` | Already wrapped (see Already abstracted); listed here only to note the underlying API is standard |
| **URL string parsing** (`extractYoutubeId` regex) | `songs/youtubeUtils.js` | Pure string work, no browser API |
| **YouTube iframe `allow="…clipboard-write…"`** | `YouTubeEmbed.jsx`, `BackingTrackCard.jsx`, `BlogPost.jsx` | A Permissions-Policy attribute delegated *to the YouTube frame*, not the app using the Clipboard API. Governed by the CSP `frame-src`, already set for Tauri |

---

## Not present at all

Explicitly searched for and **confirmed absent** from `src/` — so there is
nothing to abstract, and no future-Capacitor risk from them. Recorded so a later
reader does not have to re-run the search, and so that adding any of them later
is a conscious decision:

- **Clipboard API** (`navigator.clipboard`, `execCommand`) — the app never reads
  or writes the clipboard.
- **Web Share API** (`navigator.share`) — no share affordance.
- **File download / export** (`a.download`, object-URL download trick) — no
  export feature. Library data lives in Firestore, not local files.
- **File import** (`<input type="file">`, drag-and-drop, `dataTransfer`) — no
  upload/import anywhere.
- **Blob / `URL.createObjectURL`**, **FileReader** — not used.
- **Fullscreen API** (`requestFullscreen`) — the app never requests fullscreen;
  YouTube fullscreen is handled inside the iframe by YouTube.
- **Notifications API** (`new Notification`, `Notification.permission`) — none.
- **Wake Lock API** (`navigator.wakeLock`) — none. (A candidate *feature* for a
  metronome/tuner that should keep the mobile screen awake — noted as a future
  product decision, not a current assumption.)
- **Permissions API** (`navigator.permissions.query`) — **not used anywhere.** A
  Phase 5 pre-check in `capacitorMicrophone.js` queried `{ name: "microphone" }` to
  read a hard-denied mic up front, but a real Android device showed the query
  resolves `"denied"` even when `RECORD_AUDIO` is granted (Android System WebView
  exposes the API but does not back it with a persistent capture-permission grant —
  permission is decided per request by Capacitor's `onPermissionRequest` bridge
  when `getUserMedia` runs). The pre-check was removed; `getUserMedia` is now the
  sole authoritative permission request on every target.
- **History API** (`history.pushState` / `replaceState`) — routing is
  `HashRouter`, chosen precisely so navigation needs no server rewrites or
  History manipulation ([architecture.md](architecture.md)). The `history`
  identifier in `useDialogFocus.js` is a local `useRef`, not `window.history`.
- **Cookies** (`document.cookie`), **`document.title`**, **`screen.orientation`**,
  **geolocation**, **vibration**, **`speechSynthesis`**, **Web Workers**,
  **`BroadcastChannel`**, **IndexedDB used directly**, **Cache API** — none in app
  code. (Firebase uses IndexedDB internally for its own persistence; that is the
  SDK's concern and already works inside every webview, verified for WebView2 in
  [tauri-poc.md](tauri-poc.md).)

---

## Architecture rationale

Why only one abstraction came out of a full audit:

- **The platform seams were already cut in Phase 2.** Links, auth, storage and
  environment detection were abstracted before the shells existed, so the audit
  found them already handled rather than needing work.
- **The app is deliberately thin on browser APIs.** No file I/O, clipboard,
  share, notifications or drag-and-drop means most of the usual mobile-porting
  friction simply isn't present.
- **The project rejects empty wrappers.** A wrapper around `requestAnimationFrame`
  or `AudioContext` would return the identical value on every target — indirection
  with no replacement point, which [architecture.md](architecture.md) names as
  worse than no wrapper. The bar for a new boundary is "the answer differs on a
  target *and* a real call site needs it." Only the background-flush concern
  cleared it.
- **One boundary per concern.** The background flush had two call sites reaching
  for the same event; they collapsed into one helper rather than two near-identical
  listeners, matching the existing `subscribeToOnline` shape so no new pattern was
  introduced.

---

## Verification

| Check | Result |
| --- | --- |
| Lint | Clean — `eslint .` no errors |
| Web build | Clean — `index` 354.31 kB, 74 precache entries (unchanged) |
| Native build | Clean — `index` 354.35 kB, no service worker |
| Tree-shaking | Web bundle: **0** `@tauri-apps` / opener references. Native bundle: opener present, **0** service-worker/workbox. `pagehide` present in both, as expected — the new export is web-standard code both current targets use, so nothing native leaked into web and nothing web-only leaked out |
| Regression — song notes | Unchanged behaviour: debounced note saves on pause, on card unmount, and now on app-background via the extracted helper (same `pagehide` on web/desktop) |
| Regression — metronome settings | Unchanged: live settings sync and flush on unmount and app-background |

The two hooks are behaviourally identical to before on web and desktop — the same
`pagehide` event, now reached through one named boundary instead of two inline
listeners. The change is only visible on a future mobile shell, where that
boundary can be repointed.

---

## Remaining work before the Capacitor implementation

Nothing in the shared layer is now expected to *block* Capacitor. What remains is
integration work that needs the shell installed, all already tracked:

1. ~~**Decide the mobile auth flow.**~~ **Done (Phase 2.)** `mobileAuth.js` +
   the `@auth-impl` alias — native Google Sign-In → `signInWithCredential`
   ([mobile-auth.md](mobile-auth.md)).
2. ~~**Point `subscribeToAppBackground` at `@capacitor/app`.**~~ **Done
   (Phase 3),** behind the `@lifecycle-impl` alias — not the inline one-liner
   predicted, because the plugin's import-time `registerPlugin()` had to be kept
   out of the web/Tauri bundles (see the update box above).
3. ~~**Microphone permission plumbing.**~~ **Done (Phase 5)** — `platform/microphone/`
   (`requestPermission`/`acquireStream`/`stopStream`), a compile-time boolean
   rather than a plugin/alias because acquisition is the WebView's own
   `getUserMedia` on every target and the OS permission is native config
   (`RECORD_AUDIO` / `NSMicrophoneUsageDescription`), not a JS import.
4. ~~**Native storage driver.**~~ **Done (Phase 3)** — `capacitorStorage.js`
   (Capacitor Preferences) behind the existing `platform/storage/` contract, via
   the `@storage-impl` alias ([storage.md](storage.md)).
5. **Product decisions, not assumptions:** audio interruption/background playback
   and a possible Wake Lock for the metronome/tuner — deliberately unbuilt, listed
   here so they are chosen rather than defaulted.
