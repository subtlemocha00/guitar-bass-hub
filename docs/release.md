# Build & Release

How every target is built — locally and in CI — how it is named and versioned,
and what is deliberately still missing.

Most of the detail here is about the Windows desktop build, because it is the
one with real prerequisites. The web app is unaffected by it: `npm run build`
and `npm run deploy` are unchanged. See
[platform-roadmap.md](platform-roadmap.md) for the build-target table.

---

## Platform support

| Platform | Shell | Built by | Distribution status |
| --- | --- | --- | --- |
| Web | — | `npm run build:web` / `web.yml` | Deployed manually to Vercel via `npm run deploy` |
| PWA | service worker + manifest, part of the web build | same as Web | Installable from the deployed site |
| Windows | Tauri 2 (WebView2) | `npm run tauri:build` / `windows.yml` | **Not distributable** — unsigned, no updater |
| Android | Capacitor 8 | `npm run cap:sync` + Gradle / `android.yml` | **Not distributable** — debug-signed only |
| iOS | Capacitor 8 | project scaffolded, never built | Not supported |
| macOS / Linux | Tauri 2 | configured, never built | Not supported |

Google authentication, Firestore sync, tuner and metronome are verified on Web,
PWA, Windows and Android.

---

## Prerequisites

These apply to the local Windows desktop build. Web needs only Node; Android
additionally needs a JDK 17+ and the Android SDK.

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
| `Guitar-and-Bass-Hub.exe` | the application, ~7.0 MB |
| `bundle/nsis/Guitar and Bass Hub_<version>_x64-setup.exe` | the installer, ~5.1 MB |

CI republishes the installer under the standardised name
`Guitar-and-Bass-Hub-Setup.exe` — see [Artifacts](#artifacts).

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

### Windows naming

| Setting | Value | Where it shows |
| --- | --- | --- |
| `productName` | `Guitar and Bass Hub` | installer filename, Start Menu entry, desktop shortcut, Add/Remove Programs, install directory |
| `mainBinaryName` | `Guitar-and-Bass-Hub` | the executable |
| window `title` | `Guitar + Bass // Hub` | title bar |
| `identifier` | `com.guitarbasshub.desktop` | WebView2 data directory, installer upgrade key |

`productName` cannot contain the branded `//` — it becomes a filename and an
NSIS install path, and `/` is illegal in both. It therefore takes the documented
fallback spelling, `Guitar and Bass Hub`. The window title is free of that
constraint, so the brand survives where users actually see it. See
[Branding](#branding) for the full policy.

**The identifier must not change after the first public release.** It keys the
WebView2 profile, so changing it orphans every user's saved session and local
settings, and NSIS would treat the new build as a separate product rather than
an upgrade.

`productName` changed in Phase 11.1.1 (`Guitar Bass Hub` → `Guitar and Bass
Hub`), which moves the NSIS install directory and uninstall entry. That is safe
only because nothing has shipped yet — after a public release, changing it would
leave the old install behind instead of upgrading it.

---

## Branding

The application name is **`Guitar + Bass // Hub`**, used verbatim everywhere the
platform permits. Where `+` or `/` is not representable, the fallback is
**`Guitar and Bass Hub`** (or `Guitar-and-Bass-Hub` where a filename or
identifier wants no spaces). The name is never abbreviated in a declared field.

| Target | Location | Value |
| --- | --- | --- |
| Web | `index.html` `<title>` | `Guitar + Bass // Hub` |
| Web | `index.html` `apple-mobile-web-app-title` | `Guitar + Bass // Hub` |
| PWA | manifest `name` / `short_name` | `Guitar + Bass // Hub` |
| Android | `strings.xml` `app_name` / `title_activity_main` | `Guitar + Bass // Hub` |
| Android | `capacitor.config.json` `appName` | `Guitar + Bass // Hub` |
| Windows | Tauri window `title` | `Guitar + Bass // Hub` |
| Windows | Tauri `productName` | `Guitar and Bass Hub` — filename/path |
| Windows | Tauri `mainBinaryName` | `Guitar-and-Bass-Hub` — filename |
| CI | workflow `name:` | `Guitar + Bass // Hub — <target>` |
| CI | artifact names | `Guitar-and-Bass-Hub-*` — see [Artifacts](#artifacts) |
| npm | `package.json` `productName` | `Guitar + Bass // Hub` |

**Exceptions, and why.**

- `package.json` `name` stays `guitar-bass-hub`. npm names are restricted to
  lowercase URL-safe characters. The display name lives in the adjacent
  `productName` field instead.
- `src-tauri/Cargo.toml` `package.name` stays `guitar-bass-hub` and the lib
  target `guitar_bass_hub_lib`. Crate names are lowercase identifiers, and the
  lib name additionally has to be a valid Rust identifier. Neither is
  user-visible; `productName` and `mainBinaryName` control what users see.
- Artifact names cannot contain `/` (GitHub rejects the upload), so they take the
  fallback spelling.
- Application identifiers (`com.guitarbasshub.app`, `com.guitarbasshub.desktop`)
  and the `practice-hub:` local-storage key prefix are **deliberately untouched**.
  They are stable keys, not names: changing them would orphan every user's saved
  session, settings and local data.
- The narrow-viewport `GB//HUB` wordmark in `src/components/Layout.jsx` is a
  layout affordance for small screens, not a declared application name, so it is
  left alone.

---

## Version management

**One source of truth: the `version` field in root `package.json`.** Every other
target derives from it at build time — there is no second number to remember.

| Consumer | How it reads the version |
| --- | --- |
| Tauri binary + installer | `tauri.conf.json` → `"version": "../package.json"` |
| In-app readout (Control Center) | `vite.config.js` reads `package.json` and defines `VITE_APP_VERSION` |
| Android `versionName` | `android/app/build.gradle` parses `../../package.json` |
| Android `versionCode` | derived in the same place: `MAJOR*10000 + MINOR*100 + PATCH` |

Releasing is therefore `npm version <patch|minor|major>` and nothing else.

Android needed the derivation because `versionCode` must be a monotonically
increasing **integer**, which semver is not. Packing the components keeps it
rising with the version for any component below 100, without a separate counter
to bump. A pre-release suffix (`0.2.0-beta.1`) is kept in `versionName` and
dropped from `versionCode`.

**Remaining limitation.** `src-tauri/Cargo.toml` still carries its own
`version = "0.1.0"`. Cargo does not support reading a version from an external
file, and the Tauri workspace is a single crate so `workspace.package`
inheritance buys nothing. It is inert — Tauri stamps the binary and installer
from `tauri.conf.json`, not from Cargo — but it will drift from `package.json`
after the first bump. Options were: a prebuild script that rewrites it (adds a
generated-file-in-git problem), or `cargo-edit` (a new dependency, which this
phase excludes). Left as-is and documented rather than papered over.

---

## Continuous integration (GitHub Actions)

Phase 11.1 added reproducible CI builds for all three targets, so a build no
longer depends on a maintainer running local commands. Phase 11.1.1 audited and
hardened them. Workflows live in `.github/workflows/`:

| Workflow | File | Runner | Purpose |
| --- | --- | --- | --- |
| `Guitar + Bass // Hub — Web / PWA` | `web.yml` | `ubuntu-latest` | Vite production bundle incl. service worker + manifest |
| `Guitar + Bass // Hub — Android APK` | `android.yml` | `ubuntu-latest` | Capacitor debug APK |
| `Guitar + Bass // Hub — Windows Installer` | `windows.yml` | `windows-latest` | Tauri release binary + NSIS installer |

They **build and upload artifacts only** — nothing is deployed or released. Web
deployment is unchanged: still manual via `npm run deploy` (gh-pages) from a
maintainer's machine, so CI cannot clobber the live site.

### Triggers and running a build manually

All three run on push to `main` and on **workflow_dispatch**. `web.yml`
additionally runs on pull requests targeting `main` — it is the cheap one
(~1 min), so it gates PRs. Android (~5 min) and Windows (~6 min warm, far longer
cold) run only on `main` and on demand, because gating every PR on a
link-time-optimised Rust build is not worth the minutes.

To run one by hand: repository → **Actions** → pick the workflow in the left
sidebar → **Run workflow** → choose a branch → **Run workflow**. The dispatch
build behaves identically to a push build, including secrets.

Each workflow uses a `concurrency` group keyed on the ref. A second push to a
branch supersedes the first in-flight run; runs on `main` are never cancelled, so
every landed commit keeps a completed artifact.

### Build order

Each pipeline is strictly ordered, with nothing overlapping that shouldn't:

```text
Web       checkout -> node+npm cache -> npm ci -> vite build (web) -> upload
Android   checkout -> node+npm cache -> JDK+gradle cache -> npm ci
                   -> restore google-services.json (required)
                   -> vite build (capacitor) -> cap sync android
                   -> gradlew assembleDebug -> stage/rename -> upload
Windows   checkout -> node+npm cache -> rust toolchain -> rust cache -> npm ci
                   -> clear stale bundle -> tauri build (runs vite build native
                      itself via beforeBuildCommand) -> stage/rename -> upload
```

The two orderings that actually matter: `cap sync` has to follow the web build,
because it copies `dist-capacitor/` into the native project, and it has to
precede Gradle, which packages what was copied. `google-services.json` must be
restored before Gradle configures, because `android/app/build.gradle` applies
the `google-services` plugin from it — and now fails the build if it is absent
(see [Why google-services.json is required](#why-google-servicesjson-is-required)).

The Android build ends with a verification step that asserts, against the APK
itself, that the Firebase Authentication plugin is listed in
`capacitor.plugins.json`, that its class is in the dex, and that the
`google_app_id`, `google_api_key` and `project_id` string resources hold
well-formed values. All of those have to hold for native Google sign-in to work
at runtime.

The resource values are decoded with `aapt2 dump resources` rather than grepping
`resources.arsc` for the resource name: a name-only grep proves a resource
exists, not that `google-services.json` was processed into a usable value. Values
are checked but never printed to the log.

### Artifacts

| Workflow | Artifact name | Contents |
| --- | --- | --- |
| Web / PWA | `Guitar-and-Bass-Hub-Web` | the `dist/` bundle |
| Android APK | `Guitar-and-Bass-Hub-APK` | `Guitar-and-Bass-Hub.apk` |
| Windows Installer | `Guitar-and-Bass-Hub-Windows` | `Guitar-and-Bass-Hub-Setup.exe` |

Retention is 30 days. Gradle always emits `app-debug.apk` and Tauri always emits
`<productName>_<version>_x64-setup.exe`, neither of which is configurable, so
both are renamed in a staging step before upload. The Windows staging step fails
loudly if the glob matches anything other than exactly one installer, and the
`bundle/` directory is cleared before the build so a cached leftover from an
earlier run cannot be uploaded as if it were current.

Artifact names use the fallback spelling because GitHub rejects `/` in an
artifact name.

### Firebase configuration in CI

`.env` and `android/app/google-services.json` are both gitignored, so CI
recreates the configuration from repository secrets.

**`.env` is no longer written at all.** Vite's `loadEnv()` merges any
`VITE_`-prefixed entry of `process.env` into `import.meta.env` — and those take
precedence over a `.env` file — so the six values are passed as step-level
environment variables on the build step instead. The inlined result is identical,
and this avoids writing secrets into the workspace where an artifact upload could
capture them, and avoids interpolating secret text into a shell script.

**`google-services.json` is restored** from a base64 secret and the decoded file
is validated — it must parse and contain a client for `com.guitarbasshub.app` —
so a truncated or wrong-project secret fails at that step with a clear message
rather than five minutes later inside Gradle. The value is read from the
environment inside the script rather than interpolated into it, for the same
reason as above.

#### Why google-services.json is required

The Android build **fails** without it. It used to be treated as optional, which
was wrong and produced a green build with a broken APK:

The `google-services` Gradle plugin is what turns `google-services.json` into the
`google_app_id` / `google_api_key` string resources that Firebase's
`FirebaseInitProvider` reads at process start to construct the default
`FirebaseApp`. Without them, everything upstream still looks correct — `cap sync`
finds the plugin, `capacitor.plugins.json` lists it, Gradle compiles its class
into the APK — but at runtime `FirebaseAuth.getInstance()` throws inside
`FirebaseAuthenticationPlugin.load()`, `Bridge` catches the resulting
`PluginLoadException` and drops the plugin from the registry, and the JS side
reports:

```text
"FirebaseAuthentication" plugin is not implemented on android
```

which points at plugin registration rather than at the missing config. Both the
Gradle guard and the APK verification step exist to stop that ever shipping
silently again.

### Required repository secrets

Add at repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**.

| Secret | Used by | Required? | Effect if absent |
| --- | --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | all three | recommended | build inlines an empty Firebase config; the app cannot sign in |
| `VITE_FIREBASE_AUTH_DOMAIN` | all three | recommended | ” |
| `VITE_FIREBASE_PROJECT_ID` | all three | recommended | ” |
| `VITE_FIREBASE_STORAGE_BUCKET` | all three | recommended | ” |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | all three | recommended | ” |
| `VITE_FIREBASE_APP_ID` | all three | recommended | ” |
| `ANDROID_GOOGLE_SERVICES_JSON_BASE64` | Android | **yes** | the Android workflow fails at the restore step |
| `ANDROID_DEBUG_KEYSTORE_BASE64` | Android | **yes** | the Android workflow fails at the restore step |

The six `VITE_` secrets are not enforced: web and Windows builds are still useful
artifacts without a Firebase config, and a fork PR never receives secrets at all.
The two Android ones are enforced because the failures they cause are silent and
misleading.

#### Why the debug keystore has to come from a secret

Google authorises an app by **(package name + signing certificate SHA-1)**, so
the certificate signing the APK must be one registered in the Firebase console.

AGP signs debug builds with `~/.android/debug.keystore` and **generates a random
one if that file is absent**. On a fresh, ephemeral GitHub runner it is always
absent — so without this secret every CI run produces an APK signed by a
different, unregistered certificate. The plugin loads, Firebase initialises,
`signInWithGoogle()` runs, and then Credential Manager refuses:

```text
androidx.credentials.exceptions.NoCredentialException: No credentials available
```

Restoring the same debug keystore used locally makes the CI APK's SHA-1 match the
registered one. It needs no Gradle change — AGP's default debug signing config
already reads that path. Produce the value with:

```bash
base64 -w0 ~/.android/debug.keystore                                   # Linux/macOS
```

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.android\debug.keystore"))
```

This is a **debug** keystore with the well-known password `android`; it is not a
release credential. Release signing remains out of scope.

Check which SHA-1 an existing APK carries with:

```bash
apksigner verify --print-certs <apk> | grep "SHA-1"
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android            # the local one
```

The Android workflow asserts, after building, that the APK's signing certificate
is one of the `certificate_hash` values in `google-services.json` — compared
against the config rather than a hardcoded value, so re-registering a certificate
needs no workflow edit.

Values come from the Firebase console (Project settings → General → Your apps →
SDK setup and configuration) — the same ones described in `.env.example` and
[mobile-auth.md](mobile-auth.md). They are kept in secrets only because the files
holding them are gitignored, not because they are true secrets: they are
client-side identifiers that ship in the bundle by design, and access is
controlled by Firestore security rules.

Produce the Android value with:

```bash
base64 -w0 android/app/google-services.json      # Linux
base64 -i android/app/google-services.json       # macOS
```

```powershell
# Windows. Do NOT use certutil -encode: it wraps the output in
# -----BEGIN CERTIFICATE----- headers, which base64 -d cannot decode.
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android/app/google-services.json"))
```

Fork pull requests never receive secrets, so a fork PR of the web workflow builds
with an empty Firebase config. That is expected, and that build still passes —
the Android workflow does not run on pull requests at all.

### Caching

npm via `actions/setup-node` (keyed on `package-lock.json`); Gradle via
`actions/setup-java` (`cache: gradle`); the cargo registry and `src-tauri/target`
via `Swatinem/rust-cache` (keyed on `Cargo.lock`).

None of these can cache a stale *native* Capacitor project. `cache: gradle`
stores `~/.gradle` (the dependency cache and wrapper), not the project's `build/`
directory, and the generated files — `capacitor.plugins.json`,
`capacitor.settings.gradle`, `app/capacitor.build.gradle`,
`capacitor-cordova-android-plugins/` — are rewritten by `cap sync` on every run.
Caching was investigated as a cause of the missing-plugin bug and ruled out.

### Signing

CI matches the local build: the Android APK is **debug-signed** with the standard
debug keystore and the Windows installer is **unsigned** (see
[Known limitations](#known-limitations)). Release signing for either would need
keystore/certificate secrets and is out of scope.

### Validating a workflow change

The workflows lint clean under [actionlint](https://github.com/rhysd/actionlint),
which checks expression syntax and context availability — things GitHub only
reports after a failed run:

```bash
actionlint                       # from the repository root
```

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

**The Android APK is debug-signed.** It installs by sideload only. Play Store
distribution needs an upload keystore, `signingConfigs` in
`android/app/build.gradle`, and keystore credentials in repository secrets, plus
an AAB rather than an APK. Out of scope for this phase.

**CI builds but never releases.** The workflows upload artifacts and stop.
There is no deployment automation, no GitHub Release creation and no version
tagging — web deployment stays manual via `npm run deploy`, deliberately, so CI
cannot clobber the live site. Artifacts expire after 30 days.

**`src-tauri/Cargo.toml` carries a duplicate version number.** Inert but liable
to drift — see [Version management](#version-management).

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
