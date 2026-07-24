import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../../firebase/firebase";

// Google sign-in through a Firebase popup. Used by every current target —
// browser, installed PWA and the Tauri desktop build.
//
// WHY POPUP IS THE RIGHT CHOICE HERE
// signInWithPopup keeps the user on the page — no full-document navigation, so
// in-progress state survives sign-in. The alternative, signInWithRedirect, is
// only needed for browsers that block popups outright and costs a page reload.
//
// WHY DESKTOP USES IT TOO
// The popup was assumed to be the one thing a packaged webview could not do.
// Tested, it works: Tauri serves the app from http://tauri.localhost, which
// Firebase already treats as authorized (subdomain of the `localhost` entry),
// and the shell allows window.open for the auth handler URL specifically. See
// src/platform/auth/index.js and docs/tauri-auth-investigation.md.
//
// Note that only the *credential acquisition* is platform-specific. Every
// strategy — popup here, native Google Sign-In on mobile, system-browser OAuth
// if desktop ever needs it — ends in the same Firebase session, so
// onAuthStateChanged and everything downstream of it stays platform-agnostic
// and lives in features/auth/AuthProvider.

const provider = new GoogleAuthProvider();

// Always show Google's account chooser, even when a Google session cookie is
// already present in the webview. Signing out of Firebase does not sign the user
// out of Google inside the app's WebView2/browser profile, so without this the
// next sign-in silently re-selects the previous account. `select_account` makes
// account switching (and confirming which account you are signing in as) possible
// on a shared machine. Applies to this Firebase popup provider only — the
// Capacitor native Google Sign-In (mobileAuth.js) has its own chooser and is
// untouched.
provider.setCustomParameters({ prompt: "select_account" });

export async function signIn() {
	try {
		await signInWithPopup(auth, provider);
	} catch (err) {
		// Dismissing the popup is a normal user action, not a failure. This
		// check is popup-specific, which is why it belongs here rather than in
		// AuthProvider — a desktop OAuth flow reports cancellation differently.
		if (err?.code !== "auth/popup-closed-by-user") {
			console.error("[auth] sign-in error:", err);
		}
	}
}

export async function signOut() {
	try {
		await firebaseSignOut(auth);
	} catch (err) {
		console.error("[auth] sign-out error:", err);
	}
}
