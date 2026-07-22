# Mobile Authentication (Capacitor)

Native Google sign-in for the Capacitor build. The goal is a session
**indistinguishable** from web and desktop: the same Firebase user, the same
`uid`, the same Firestore access — only the credential-acquisition step differs.

**Status.** The app-side implementation and bundle isolation are complete and
verified. The Firebase Console / native OAuth configuration and the on-device
sign-in test are **documented but not performed here** — they require the
project's Firebase Console, a signing keystore, and a device/simulator, none of
which exist in this build environment. See [Verification](#verification).

---

## Why mobile cannot reuse the desktop popup

Confirmed from current Google/Firebase documentation in the Phase 0
investigation (see [platform-roadmap.md](platform-roadmap.md) and
[tauri-auth-investigation.md](tauri-auth-investigation.md)). Two independent
blocks stack:

1. **Protocol guard.** `signInWithPopup` requires an http/https origin.
   Capacitor's default `capacitor://localhost` fails Firebase's `HTTP_REGEX`
   guard. `iosScheme: 'https'` would fix *this* — but not the next one.
2. **Embedded-webview policy.** Google's OAuth "secure browsers" policy blocks
   `WKWebView` (iOS) and Android `WebView` with `disallowed_useragent` — the
   exact environment a Capacitor app runs in. Unlike Tauri's WebView2 (which
   opens a genuine browser window with a stock desktop UA), a mobile webview
   cannot present Google's sign-in page.

So the credential must be acquired through the platform's **native** Google
Sign-In, then exchanged for a Firebase session. This is Firebase's own
recommended pattern for Capacitor.

## Chosen plugin

**`@capacitor-firebase/authentication`** (Capawesome), version **8.3.0**.

| Why | Detail |
| --- | --- |
| Identified in Phase 0 | The plugin the planning investigation named as the recommended path. |
| Matches the required flow | Its documented "use with the Firebase JS SDK" mode returns a Google `idToken`, which becomes `GoogleAuthProvider.credential(idToken)` → `signInWithCredential()` — exactly the flow this phase requires. |
| Maintained + compatible | Peer deps `@capacitor/core >=8.0.0` (we run 8.4.2) and `firebase ^12.6.0` (we run 12.12.1). Actively maintained, tracks Capacitor majors. |
| Both platforms | One plugin covers native Google Sign-In on iOS and Android. |

`skipNativeAuth: true` is set in [capacitor.config.json](../capacitor.config.json):
the plugin performs the Google Sign-In but does **not** sign in to the *native*
Firebase SDK. The single source of truth stays the Firebase **JS SDK** `auth`
instance that `AuthProvider` already listens to — no second session, no
duplicated Firebase logic.

## The flow

```text
SIGN IN (mobile)
   │
   ▼
FirebaseAuthentication.signInWithGoogle()      native account chooser (plugin)
   │   → result.credential.idToken
   ▼
GoogleAuthProvider.credential(idToken)         Firebase JS SDK
   │
   ▼
signInWithCredential(auth, credential)         same `auth` as web/desktop
   │
   ▼
onAuthStateChanged fires in AuthProvider       → identical user, identical uid
```

All of this lives in [src/platform/auth/mobileAuth.js](../src/platform/auth/mobileAuth.js).
`AuthProvider`, Firestore, the feature modules, `request.auth.uid` rules and the
user profile handling are **unchanged** — native packaging changes the client
method, not the identity.

## How the target is selected (and why it is a build alias)

Selection is compile-time, keyed on the Phase 1 build target. But it is done
with a **Vite `resolve.alias`** (`@auth-impl` → `webAuth.js` or `mobileAuth.js`,
see [vite.config.js](../vite.config.js)), **not** an in-source
`isCapacitor ? mobileAuth : webAuth`.

The reason is specific: `@capacitor-firebase/authentication` calls
`registerPlugin()` at import time — a **side effect**. A static import with a
side effect cannot be tree-shaken, so an in-source branch would drag the plugin
into the web and Tauri bundles even with `isCapacitor` folded to `false`. (This
is the same reason [platform.js](../src/platform/platform.js) reads the
`window.Capacitor` global instead of importing `@capacitor/core`.) An alias
means only the selected file ever enters the module graph, so:

- web / Tauri bundles: **zero** `@capacitor-firebase`, popup path only;
- Capacitor bundle: native path only, **zero** Tauri auth references.

Verified per bundle — see below. `platform/links` still uses the in-source
`isTauri ? … : …` form because the Tauri opener is side-effect-free and tree-
shakes cleanly; auth needed the stronger guarantee.

## Native configuration required (not performed here)

These steps need the project's **Firebase Console**, a signing keystore, and the
platform toolchains (Android Studio / a Mac with Xcode). They could not be done
or validated in this environment, so they are documented for completion on a
build machine. The two config files are **gitignored** (same class of
client-side identifiers as `.env`).

**Firebase Console**

- Google is already enabled as a sign-in provider (used by web/desktop).
- Register an **Android app** with package name `com.guitarbasshub.app`, and add
  the debug **and** release **SHA-1 + SHA-256** fingerprints
  (`cd android && ./gradlew signingReport`, or `keytool -list -v -keystore …`).
  Google Sign-In on Android will not work without the SHA fingerprints.
- Register an **iOS app** with bundle id `com.guitarbasshub.app`.

**Android**

1. Download `google-services.json` → `android/app/google-services.json`.
2. Add the Google Services Gradle plugin:
   - `android/build.gradle`: `classpath 'com.google.gms:google-services:4.4.2'`
     (or current) in `buildscript.dependencies`;
   - `android/app/build.gradle`: `apply plugin: 'com.google.gms.google-services'`.
3. No extra manifest permissions are required for Google Sign-In beyond
   Capacitor's defaults (internet). **Do not add unrelated permissions.**

**iOS**

1. Download `GoogleService-Info.plist` → `ios/App/App/GoogleService-Info.plist`.
2. Add the **reversed client ID** (from that plist, key `REVERSED_CLIENT_ID`) as
   a URL scheme in `ios/App/App/Info.plist` under `CFBundleURLTypes`.
3. Confirm `AppDelegate` forwards the URL callback if the installed plugin
   version requires it (recent versions handle this via the Capacitor bridge).

The plugin itself is already registered natively (via `npx cap sync`): the
Android Gradle include and iOS `Package.swift` reference it.

## Firestore transport — investigated, left unchanged

Phase 0 flagged that Firestore's WebChannel transport can fail in some mobile
webviews, needing `experimentalAutoDetectLongPolling`. Per the "do not enable
pre-emptively — only with evidence" instruction:

- **No change was made** to [src/firebase/db.js](../src/firebase/db.js). There is
  no evidence of a failure, and one cannot be produced here: reproducing it needs
  a signed-in session on a real device, because this app's Firestore rules
  require auth.
- **Symptom to watch on device:** `onSnapshot` listeners that never fire, or a
  console warning like *"WebChannelConnection RPC 'Listen' stream … transport
  errored."* Home counters and lists staying empty while signed in is the
  user-visible tell.
- **The fix, only if it manifests:** add `experimentalAutoDetectLongPolling: true`
  to the existing `initializeFirestore(...)` options in `db.js` (it auto-detects
  and only long-polls when WebChannel fails — one line, same call). Record the
  console evidence that justified it.

## Verification

**Verified in this environment:**

| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run build` / `build:native` / `build:capacitor` | all pass |
| Bundle isolation — web | 0 `@capacitor-firebase`; webAuth present |
| Bundle isolation — Tauri | 0 `@capacitor-firebase`; webAuth present |
| Bundle isolation — Capacitor | plugin present; 0 `@tauri-apps`; mobileAuth present, popup path absent |
| Capacitor boot (served at a root origin) | app mounts, signed-out SIGN IN shown, **0 console errors** with the plugin registered at startup |
| Production audit (`--omit=dev`) | 0 vulnerabilities |

**Requires a device + the native config above (cannot be run here):** native
Google sign-in succeeds; Firebase receives the user; `uid` matches the account;
Firestore data loads; name/photo display; sign-out; session restored after
relaunch and after a cold app restart; no console errors on device. The code
path is in place and the web/desktop flows are unaffected; this is the honest
empirical gap, inherent to not having a mobile build/test rig.

## Remaining unknowns for later phases

- **iOS session persistence.** Firebase Auth persists to IndexedDB in the
  webview; WKWebView IndexedDB has historically been less reliable than
  WebView2's. `getAuth()` already selects IndexedDB persistence by default, so no
  change was made — but if relaunch does not restore the session on a real
  device, `initializeAuth(app, { persistence: indexedDBLocalPersistence })` in
  `firebase/firebase.js` is the documented fix (a minimal shared change, made
  only with evidence).
- **Token refresh** over a long-running session and **offline sign-in** (a
  returning user with no network) remain unverified on every platform — carried
  over from [tauri-auth-investigation.md](tauri-auth-investigation.md).
- **Sign-out semantics.** `signOut()` clears both the native Google session and
  the Firebase JS session; whether that fully clears Google's account cache on
  device (so the next sign-in re-prompts) is worth confirming on hardware.
