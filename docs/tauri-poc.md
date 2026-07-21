# Tauri Proof of Concept

Phase 3, step 1. A minimal desktop shell around the existing React app, built to
**validate assumptions** — not to migrate anything.

No application source was modified. Web behaviour, PWA support and the web
deployment are untouched.

---

## Setup

### Versions

| Component | Version |
| --- | --- |
| Tauri CLI / core | 2.11.4 / 2.11.5 |
| `tauri-build` | 2.6.3 |
| Rust | 1.97.1 (stable-x86_64-pc-windows-msvc) |
| WebView2 runtime | 150.0.4078.83 |
| MSVC toolset | 14.44.35207 |
| Windows SDK | 10.0.26100.0 |

### Prerequisites (Windows)

Tauri compiles a real Rust binary, so a browser-only machine cannot build it:

1. **Rust** via `rustup` — installs to `%USERPROFILE%\.cargo`, no admin needed.
2. **MSVC C++ Build Tools** — the `Microsoft.VisualStudio.Workload.VCTools`
   workload. Requires admin (UAC), several GB.
3. **WebView2 runtime** — preinstalled on Windows 11.

> **Gotcha:** the Windows SDK `Lib` directory appears on disk *before* the
> install finishes. A build attempted at that point fails with
> `LINK : fatal error LNK1181: cannot open input file 'dbghelp.lib'`. Wait for
> the installer process to exit, then confirm
> `Windows Kits\10\Lib\<ver>\um\x64\dbghelp.lib` exists.

Verify the toolchain independently of Tauri before debugging a Tauri build —
`cargo new` a hello-world and build it. It takes seconds and isolates linker
problems from Tauri ones.

### Files added

```text
src-tauri/
  Cargo.toml            crate manifest (tauri 2.11, tauri-plugin-log)
  Cargo.lock            committed - this is a binary crate
  build.rs
  tauri.conf.json       the only file with project-specific config
  capabilities/default.json
  src/main.rs           thin entry -> app_lib::run()
  src/lib.rs            Builder::default() + log plugin in debug
                        (since extended with the auth popup allow-list)
  icons/                default Tauri icons (placeholder)
```

`src-tauri/target/` and `src-tauri/gen/schemas` are gitignored.

### npm scripts

| Script | Purpose |
| --- | --- |
| `npm run tauri:dev` | Vite dev server (native mode) + debug shell, hot reload |
| `npm run tauri:build` | `build:native` then compile the release binary |

---

## Architecture

The shell consumes the **existing** native build target. There is no second
frontend build.

```text
React source
    |
npm run build:native        (vite --mode native)
    |                         base './', PWA plugin omitted,
    |                         VITE_BUILD_TARGET = "native"
dist-native/
    |
tauri build                 (frontendDist: "../dist-native")
    |
app.exe                     assets embedded in the binary
```

Config deltas from the generated scaffold, all in `tauri.conf.json`:

| Field | Value | Why |
| --- | --- | --- |
| `identifier` | `com.guitarbasshub.desktop` | scaffold ships `com.tauri.dev`, which Tauri warns about |
| `build.frontendDist` | `../dist-native` | reuse the native target |
| `build.beforeBuildCommand` | `npm run build:native` | keep the binary in sync |
| `build.beforeDevCommand` | `npm run dev -- --mode native --port 5180 --strictPort` | see Finding 1 |
| `build.devUrl` | `http://localhost:5180` | see Finding 2 |
| `app.windows[0]` | 1280x800, min 900x600 | 800x600 makes a wide dashboard look broken |
| `app.security.csp` | `null` (scaffold default) | see Finding 5 |

---

## Findings

### 1. `tauri dev` would have run the app in **web** mode

`devUrl` points at the Vite dev server, and the scaffold's `beforeDevCommand`
is plain `npm run dev` — which builds with `VITE_BUILD_TARGET="web"`. Dev mode
would therefore report `isNative === false` and exercise the *web* auth, links
and platform branches, while `tauri build` exercised the native ones.

Silent and easy to miss: dev would appear to work while testing the wrong code
path entirely.

**Fixed** by passing `--mode native` in `beforeDevCommand`. Confirmed the dev
server then reports `VITE_BUILD_TARGET: "native"`.

### 2. Dev port must be pinned

Port 5173 was already occupied on the development machine, and Vite silently
auto-increments when the port is not pinned — leaving `devUrl` pointing at
whatever else is listening.

**Fixed** by pinning both ends to 5180 with `--strictPort`, so a conflict fails
loudly instead of loading the wrong server.

### 3. The webview origin is `http://tauri.localhost` — better than expected

Confirmed from the WebView2 profile on disk: both the localStorage and
IndexedDB namespaces are keyed `http_tauri.localhost_0`.

This matters more than it looks. Earlier audits assumed a custom scheme
(`tauri://localhost`), which is the root of the predicted Firebase
authorised-domain and YouTube embedding problems. An **http scheme with a real
hostname** is materially friendlier to both. It does not make those problems
disappear — `tauri.localhost` still has to be an authorised domain for any
browser-based OAuth — but the assumption behind the pessimistic forecast was
wrong and should be re-tested rather than trusted.

### 4. Platform detection works, with a caveat

`isNative` derives from the compile-time `VITE_BUILD_TARGET`, so it is correct
in the shipped binary. Proven by dead-code elimination in `dist-native`:

| Probe | `dist/` (web) | `dist-native/` |
| --- | --- | --- |
| `display-mode: standalone` | present | **absent** |
| `navigator.standalone` | present | **absent** |
| `serviceWorker.controller` | present | **absent** |

Those branches can only vanish if `isNative` folded to `true` at build time.
(`matchMedia` still appears in the native bundle, but it belongs to React DOM's
stylesheet preloading, not to `platform.js`.)

**No change was needed** for the PoC. The caveat: detection is *build-target*
based, so `isNative` is true for any native build — including
`npm run preview:native` in a plain browser. It does not detect the Tauri
**runtime**. That is sufficient today and deliberately unchanged; when
`platform()` needs to distinguish desktop from mobile, `window.__TAURI_INTERNALS__`
is the runtime probe to add.

### 5. No CSP is set

The scaffold ships `"csp": null`, i.e. no Content-Security-Policy. Everything
loads, including YouTube iframes. When a CSP is added for production hardening,
`frame-src https://www.youtube-nocookie.com` becomes required — the risk
recorded in
[youtube-native-compatibility.md](youtube-native-compatibility.md) is real but
not yet triggered.

### 6. ESLint breaks after the first Tauri build

`src-tauri/target/**/tauri-codegen-assets/*.js` are **brotli-compressed blobs
with a `.js` extension**. ESLint's flat config does not read nested
`.gitignore` files, so once a build has run, `npm run lint` fails with 34
`Parsing error: Unexpected character` errors.

Confusing because it only appears *after* a successful build, and the errors
point at files nobody wrote.

**Fixed** by adding `src-tauri/target` and `src-tauri/gen` to the `ignores` list
in `eslint.config.js` — the only application-repo file this PoC had to change.

### 7. Firebase initialises inside the webview

Confirmed from the WebView2 IndexedDB profile after a run:

- `firebaseLocalStorageDb` (object store `firebaseLocalStorage`) — Auth
  persistence
- `firebase-heartbeat-database` recording `fire-core/0.14.11`,
  `fire-auth/1.13.0`, `fire-js-all-app/12.12.1`
- Firebase's `__sak` storage-availability probe in localStorage

So the SDK loads, detects storage, and persists. **Firestore read/write over
the network was not exercised** — the app was launched signed out, and the
Firestore cache is created lazily on first query.

---

---

## What was verified, and how

The release binary was launched and its window captured with `PrintWindow`
(`PW_RENDERFULLCONTENT`). The Home route rendered fully: neon styling,
self-hosted fonts, live session clock, `SIGN IN` in the header, counters at 0.

That single capture proves several things at once, because of how startup is
ordered:

| Proven | Why the render proves it |
| --- | --- |
| React mounts and renders | pixels |
| Assets resolve from `./` | fonts and CSS are applied |
| **Storage hydration resolves** | `main.jsx` renders *inside* `hydrateStorage().then(...)` — no render is possible until it resolves |
| **Auth state resolves** | `App` returns `null` while `loading`; content means `onAuthStateChanged` fired |
| HashRouter matches the initial route | Home rendered and the breadcrumb reads `HOME` |
| Signed-out path is correct | `SIGN IN` shown, counters 0 |

Additionally verified without the UI:

- **Auth boundary**, by unit test against the real selection logic in
  `platform/auth/index.js` with `isNative` stubbed both ways: web delegates to
  `webAuth`; native throws `AuthNotImplementedError`, names the file to edit,
  and never silently falls back to the web implementation (10/10). *That
  behaviour has since been replaced — desktop uses the popup flow.*
- **Platform detection**, by dead-code elimination in `dist-native` (Finding 4).
- **Firebase**, from the WebView2 IndexedDB profile (Finding 7).

### Not verified

- **In-app navigation.** Synthetic mouse input (`mouse_event`) did not reach
  WebView2's content process, so a scripted click on a route link did not
  navigate. This was a limitation of input injection, **not evidence of a
  routing bug** — the window was captured before and after and only the clock
  advanced.

  **Cause found later:** `SetForegroundWindow` is refused when called from a
  background process, so the click landed on an unfocused window. Attaching to
  the foreground thread's input queue first (`AttachThreadInput`) fixes it, and
  a scripted click on SIGN IN then worked. Route clicks were never retried, so
  navigation itself is still unverified.

  Reasoning, not proof: HashRouter navigation is entirely client-side. Changing
  the fragment issues no request, so it cannot reach the custom protocol
  handler. A refresh on `#/bass` re-requests path `/`, which demonstrably
  works. Route changes are therefore expected to be safe by construction — but
  this should be clicked through once by hand.
- **Firestore over the network.** The app was signed out, and the Firestore
  cache is created lazily on first query. Blocked behind native auth.
- **Tuner and metronome**, YouTube embeds, and anything requiring interaction.

---

## Known limitations

- ~~**Authentication is not implemented on native, by design.**~~ **Superseded.**
  At PoC time the native branch of `platform/auth` threw
  `AuthNotImplementedError`, confirmed present in `dist-native` with the web
  popup implementation absent. Desktop sign-in now uses the popup flow; see
  [tauri-auth-investigation.md](tauri-auth-investigation.md).
- **Storage still uses `localStorage`** via the web driver. It works in the
  webview, but native durability (OS eviction) is unaddressed.
- **Icons are Tauri placeholders**, not the app's own.
- **No CSP, no signing, no installer bundle.** Built with `--no-bundle`.
- **`productName` is `guitar-bass-hub`** and the binary is `app.exe` (the crate
  is named `app`); cosmetic, worth renaming before any real distribution.

---

## Next steps

Ordered by what unblocks the most:

1. **Native authentication.** System-browser OAuth with a loopback redirect,
   then `signInWithCredential`. Now that the origin is known to be
   `http://tauri.localhost`, check whether it can be registered as a Firebase
   authorised domain before designing around the loopback flow.
2. **Exercise Firestore signed in** — confirm the WebChannel transport works
   in WebView2 and whether `experimentalAutoDetectLongPolling` is needed.
3. **Test the tuner.** `getUserMedia` in WebView2 inherits the OS microphone
   privacy setting — the exact failure mode already seen on the web.
4. **Test a YouTube embed** before adding a CSP, then again after.
5. **Storage driver** — only once native durability actually matters.
6. **Icons, product name, bundling, signing** — packaging concerns, last.
