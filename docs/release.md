# Desktop Release

How to produce a distributable Windows build, what has to be true first, and
what is deliberately still missing.

The web app is unaffected by everything here — `npm run build` and
`npm run deploy` are unchanged. See [platform-roadmap.md](platform-roadmap.md)
for the build-target table.

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Node 20+ and `npm install` | The frontend build runs first, as `beforeBuildCommand` |
| Rust stable (MSVC toolchain on Windows) | `rustup default stable-x86_64-pc-windows-msvc` |
| Visual Studio Build Tools + Windows SDK | Needed for the MSVC linker. **Wait for the installer to finish** — the SDK `Lib` directory appears before the install completes, and building too early fails on `dbghelp.lib` |
| WebView2 runtime | Present on Windows 10 1803+ by default; the installer downloads it if missing |
| A populated `.env` | The Firebase config is inlined at build time. A build with an empty `.env` produces an app that cannot sign in |

NSIS itself is **not** a prerequisite — the Tauri CLI downloads it on first use.

---

## Building

```bash
npm run tauri:build        # frontend + release binary + NSIS installer
npx tauri build --no-bundle   # binary only, skips the installer (faster)
```

Artifacts land in `src-tauri/target/release/`:

| Path | What |
| --- | --- |
| `guitar-bass-hub.exe` | the application, ~7.0 MB |
| `bundle/nsis/Guitar Bass Hub_<version>_x64-setup.exe` | the installer, ~5.1 MB |

A release build takes roughly five to six minutes because of link-time
optimisation. `--no-bundle` skips only the installer, not the optimisation.

`cargo check --release --all-targets` is clean — no compiler warnings.

### Dev differs from release in one way that matters

`npm run tauri:dev` serves the frontend from `http://localhost:5180` rather than
`http://tauri.localhost`. Origin-scoped storage — the Firebase session,
IndexedDB, the storage driver's keys — is therefore **separate**: the dev build
starts signed out even when the installed app is signed in. That is inherent to
`devUrl` and not a defect, but it does mean "it worked in dev" says nothing about
the release build's session handling.

Single-instance also spans the two: the plugin keys on the app identifier, so a
running release build will silently steal focus instead of letting `tauri dev`
open its own window. Close the installed app before starting dev.

### Versioning

One source of truth: `package.json`. `src-tauri/tauri.conf.json` reads it with
`"version": "../package.json"`, and `vite.config.js` injects the same value as
`VITE_APP_VERSION`, which the Control Center displays. Bump `package.json` and
everything follows — binary metadata, installer filename, in-app readout.

### Naming

| Setting | Value | Where it shows |
| --- | --- | --- |
| `productName` | `Guitar Bass Hub` | installer name, Start Menu entry, install directory |
| `mainBinaryName` | `guitar-bass-hub` | the executable |
| window `title` | `Guitar + Bass // Hub` | title bar |
| `identifier` | `com.guitarbasshub.desktop` | WebView2 data directory, installer upgrade key |

`productName` cannot contain the branded `//` — it becomes a filename on every
platform. The window title is free of that constraint, so the brand survives
where users actually see it.

**The identifier must not change after the first public release.** It keys the
WebView2 profile, so changing it orphans every user's saved session and local
settings, and NSIS would treat the new build as a separate product rather than
an upgrade.

---

## Installer behaviour

NSIS, `installMode: currentUser` — installs to the user's AppData with **no
administrator prompt**, which suits an unsigned app better than a machine-wide
install.

`webviewInstallMode` is left at Tauri's default, `downloadBootstrapper`: the
installer is small but needs internet access on a machine without WebView2.
Switch to `embedBootstrapper` (+~1.8 MB) or `offlineInstaller` (+~127 MB) if
offline installation matters.

MSI is deliberately not built. It requires WiX, produces a second artifact to
test and sign, and its main advantage — group-policy deployment — has no
audience here. `"targets": ["nsis"]` rather than `"all"`, so a Windows build
produces exactly one installer.

---

## Security posture

| Control | State |
| --- | --- |
| CSP | Set. `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'none'` |
| Remote origins allowed | `connect-src` Google APIs only; `frame-src` youtube-nocookie and `*.firebaseapp.com` |
| Tauri capabilities | One permission: `opener:allow-open-url`, scoped to http/https/mailto |
| Popups | Allow-list of exactly the Firebase auth handler; everything else denied |
| External links | System browser via the opener plugin, never an in-app window |
| Devtools | Not compiled in — the `devtools` Cargo feature is off in release |
| Logging | The log plugin is `#[cfg(debug_assertions)]`, so it is absent from release builds |

Three notes on the CSP:

- `style-src` allows `'unsafe-inline'` because React writes `style` attributes.
  Scripts are not exempted — `script-src 'self'` with no `'unsafe-inline'` and
  no `'unsafe-eval'`. Tauri injects `sha256-` hashes for its own bootstrap
  automatically, so nothing had to be loosened for the framework.
- `connect-src` must include **`ipc: http://ipc.localhost`**. Tauri's own IPC
  transport is a fetch to that origin on Windows, and unlike the script hashes it
  is *not* added for you. Omitting it produces an app that looks entirely
  healthy — it signs in, loads Firestore, plays video — while every Tauri command
  fails silently. Here that meant external links stopped opening, caught only
  because the check exercised a link rather than trusting the smoke test.
- Hosts are matched by pattern (`https://*.firebaseapp.com`), not by project.
  The Firebase project name lives in `.env`, which is gitignored, and hardcoding
  it here would have put it in git for no benefit.

`core:default` was removed from the capability set. The frontend calls exactly
one Tauri command, and the default set grants window, webview, menu, tray, path
and resource APIs that nothing uses. Verified after removal: the app launches,
signs in, loads Firestore, plays YouTube and opens external links.

---

## Known limitations

**The build is unsigned.** SmartScreen will warn on first run, and some
corporate environments will block it outright. Fixing this needs a code-signing
certificate (OV is a few hundred dollars a year; EV clears SmartScreen
immediately, OV builds reputation over time). Configure via
`bundle.windows.certificateThumbprint` / `signCommand`. **This is the single
biggest gap between "builds" and "distributable".**

**Windows x64 only, so far.** The other targets are configured but unbuilt: no
macOS or Linux artifact has ever been produced, and macOS additionally needs
notarisation and a `NSMicrophoneUsageDescription` for the tuner.

**No update mechanism.** Tauri's updater plugin is not installed, so users would
have to download and reinstall by hand. Worth adding before there are users to
strand — it needs a signing keypair and somewhere to host a manifest.

**The icon is the app's illustration, not a mark.** It is correct branding and
much better than the placeholder it replaced, but the source art is a detailed
circuit-board scene that turns to noise below about 48px. A simplified
silhouette would read far better in the taskbar. Source is
`public/pwa-512x512.png`; regenerate with `npx tauri icon <file>`. A 1024px
master would also improve the macOS `.icns`, which is currently upscaled from
512.

**Publisher and copyright are placeholders.** `bundle.publisher` and
`bundle.copyright` name the GitHub handle. If this ships under a real identity
or entity, set them accordingly — they appear in installer metadata and file
properties. There is also **no LICENSE file** in the repository.

**Windows-only verification.** Everything above was tested on Windows 11 with
WebView2 `Edg/150.x`. Linux uses WebKitGTK, which differs enough that the tuner
and YouTube embeds need retesting there — see
[platform-roadmap.md](platform-roadmap.md). The CSP in particular is
Windows-shaped: `http://ipc.localhost` is the Windows IPC origin, and other
platforms use the `ipc:` scheme, which is why both are listed.

**Dependencies are pinned as verified.** `npm audit --omit=dev` reports zero
vulnerabilities. Ten packages have newer minor/patch releases available
(React 19.2.5 → 19.2.8, Firebase 12.12.1 → 12.16.0, Vite 8.0.16 → 8.1.5 among
them). They were deliberately not updated during this pass: every desktop
behaviour here was verified against the current tree, and bumping ten packages
would invalidate that for no security benefit. Update and re-verify as its own
change.

---

## Reducing size further

Already applied: `opt-level = "s"`, `lto = true`, `codegen-units = 1`,
`panic = "abort"`, `strip = true` — together these took the binary from 12.5 MB
to 7.0 MB.

What is left is mostly frontend. The largest chunk is the Firestore SDK at
~304 KB gzipped, already split off the critical path and loaded only when a
data-bound route opens. Fonts are ~150 KB of self-hosted woff2. Neither is worth
attacking without a measurement showing it matters.

The unused Tauri mobile icon sets (`icons/android/`, `icons/ios/`) were removed:
mobile is planned via Capacitor, not Tauri, so those 3.2 MB could never be used.
