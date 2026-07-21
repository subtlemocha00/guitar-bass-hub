import * as webAuth from "./webAuth";

// Platform-aware authentication boundary.
//
// WHY AUTH IS ABSTRACTED
// Acquiring a Google credential is the one part of this app most likely to
// differ per target, and the audit named it the primary blocker for native
// builds: signInWithPopup needs a second window and a cross-origin postMessage
// back to the Firebase authDomain. Isolating the credential step here means a
// swap is one file rather than a change to AuthProvider and everything below.
//
// WHY EVERY TARGET CURRENTLY USES webAuth
// The popup flow was expected to be impossible on desktop; it is not. An
// isolated Tauri experiment (docs/tauri-auth-investigation.md) established
// three things:
//
//   1. Tauri's webview is served from http://tauri.localhost — an http origin
//      with a real hostname, not the custom scheme earlier audits assumed.
//      Firebase matches authorized domains by subdomain, so the existing
//      `localhost` entry already covers it. No Firebase Console change.
//   2. window.open works once the shell answers the new-window request. The
//      Tauri shell now allows exactly the Firebase auth handler URL and denies
//      everything else — see src-tauri/src/lib.rs.
//   3. Google renders its real sign-in page in that popup: it is a genuine
//      browser window with a visible address bar, not an embedded webview, so
//      the disallowed_useragent policy does not apply.
//
// So there is no native-specific credential flow to write, and no branch here:
// the same module serves web, PWA and desktop. Adding a native branch that
// re-exported webAuth would be indirection with nothing behind it.
//
// WHAT THE ABSTRACTION IS STILL FOR
// Point 3 is Google policy, not a contract, and Capacitor's
// capacitor://localhost is a custom scheme that fails Firebase's protocol
// guard. If either forces a change, the replacement lands as a sibling module
// selected by platform() here, and nothing else in the app moves:
//
//   desktopAuth.js   Tauri — Google consent screen in the *system* browser,
//                    catch the loopback redirect, exchange the code, then
//                    signInWithCredential().
//   mobileAuth.js    Capacitor — native Google Sign-In returns an idToken,
//                    which becomes GoogleAuthProvider.credential(idToken) and
//                    then signInWithCredential().
//
// Both converge on signInWithCredential, so the resulting session is
// indistinguishable from today's and AuthProvider is unaffected either way.
// Neither is written yet: the tested path does not need them.
//
// WHAT IS DELIBERATELY *NOT* BEHIND THIS BOUNDARY
// Only credential acquisition can vary. Every strategy ends with the same
// Firebase session, so onAuthStateChanged, the user object, the loading gate
// and all consumers are platform-agnostic and stay in
// features/auth/AuthProvider.

/**
 * Start the platform's sign-in flow. Resolves once the Firebase session is
 * established; recoverable failures (including user cancellation) are handled
 * by the implementation and do not reject.
 */
export const platformSignIn = webAuth.signIn;

/** End the current session. */
export const platformSignOut = webAuth.signOut;
