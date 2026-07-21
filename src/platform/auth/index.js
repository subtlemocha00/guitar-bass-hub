import { isNative } from "../platform";
import * as webAuth from "./webAuth";

// Platform-aware authentication boundary.
//
// WHY AUTH IS ABSTRACTED
// Acquiring a Google credential is the one part of this app that cannot work
// the same way on every target. The audit named it the primary blocker for
// native builds: signInWithPopup needs a second window and a cross-origin
// postMessage back to the Firebase authDomain, and a custom scheme such as
// tauri://localhost or capacitor://localhost can never be a Firebase
// authorized domain. Isolating the credential step here means the swap is one
// file rather than a change to AuthProvider and everything below it.
//
// WHAT IS DELIBERATELY *NOT* BEHIND THIS BOUNDARY
// Only credential acquisition varies. Every strategy ends with the same
// Firebase session, so onAuthStateChanged, the user object, the loading gate
// and all consumers are platform-agnostic and stay in
// features/auth/AuthProvider. Widening this abstraction beyond signIn/signOut
// would add indirection with nothing behind it.
//
// HOW NATIVE PLUGS IN
// platform() currently answers "web" | "native". Once a shell is installed it
// widens to "desktop" | "ios" | "android", and the branch below gains a case
// per implementation:
//
//   desktopAuth.js   Tauri — open the Google consent screen in the *system*
//                    browser, catch the loopback/deep-link redirect, exchange
//                    the code, then signInWithCredential(). The system browser
//                    is required: an embedded webview is refused by Google's
//                    OAuth policy.
//   mobileAuth.js    Capacitor — native Google Sign-In returns an idToken,
//                    which becomes GoogleAuthProvider.credential(idToken) and
//                    then signInWithCredential().
//
// Both converge on signInWithCredential, so from AuthProvider's perspective
// nothing about the resulting session differs.
//
// Those modules are not created yet: writing them without a shell to run
// against would mean guessing at two different redirect models, and they would
// be unreachable and untestable. The native branch throws instead, so a native
// build fails loudly at the exact spot that needs implementing rather than
// failing mysteriously inside a popup that cannot open.

function notImplemented(action) {
	return () => {
		const err = new Error(
			`[auth] ${action} has no native implementation yet — see src/platform/auth/index.js`
		);
		err.name = "AuthNotImplementedError";
		throw err;
	};
}

// isNative is a build-time constant, so the web build keeps only webAuth and
// drops the branch below entirely.
const impl = isNative
	? { signIn: notImplemented("sign-in"), signOut: notImplemented("sign-out") }
	: webAuth;

/**
 * Start the platform's sign-in flow. Resolves once the Firebase session is
 * established; recoverable failures (including user cancellation) are handled
 * by the implementation and do not reject.
 */
export const platformSignIn = impl.signIn;

/** End the current session. */
export const platformSignOut = impl.signOut;
