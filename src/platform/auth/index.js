// The concrete credential-acquisition module is chosen at BUILD TIME by a Vite
// alias (`@auth-impl`, see resolve.alias in vite.config.js):
//   web + Tauri desktop -> ./webAuth   (signInWithPopup)
//   Capacitor mobile    -> ./mobileAuth (native Google Sign-In + signInWithCredential)
// so only the selected file enters each bundle. See vite.config.js for WHY it is
// an alias and not a source-level `isCapacitor ? … : …`.
import * as impl from "@auth-impl";

// Platform-aware authentication boundary.
//
// WHY AUTH IS ABSTRACTED
// Acquiring a Google credential is the one part of this app that genuinely
// differs per target. Isolating that step here means a swap is one file rather
// than a change to AuthProvider and every consumer below it.
//
// WHO USES WHAT, AND WHY MOBILE DIFFERS
//   Web + Tauri desktop -> signInWithPopup. Verified end to end in the browser
//     and in Tauri's WebView2 (an http://tauri.localhost origin, a genuine
//     browser popup window Google accepts — docs/tauri-auth-investigation.md).
//   Capacitor mobile     -> native Google Sign-In, then signInWithCredential.
//     The popup CANNOT work in a mobile webview: capacitor://localhost fails
//     Firebase's HTTP_REGEX protocol guard, and Google's "secure browsers" OAuth
//     policy blocks WKWebView and Android WebView with disallowed_useragent.
//     Confirmed from current Google/Firebase documentation (docs/mobile-auth.md).
//     This is the native branch the Tauri work removed and the roadmap said
//     mobile would have to reintroduce.
//
// WHAT IS DELIBERATELY *NOT* BEHIND THIS BOUNDARY
// Only credential acquisition varies. Every path ends in the same Firebase
// session on the same `auth` instance, so onAuthStateChanged, the user object,
// its uid, the loading gate and all consumers stay platform-agnostic in
// features/auth/AuthProvider. Native packaging changes the client method, not
// the identity — rules keyed on request.auth.uid are untouched.

/**
 * Start the platform's sign-in flow. Resolves once the Firebase session is
 * established; recoverable failures (including user cancellation) are handled
 * by the implementation and do not reject.
 */
export const platformSignIn = impl.signIn;

/** End the current session. */
export const platformSignOut = impl.signOut;
