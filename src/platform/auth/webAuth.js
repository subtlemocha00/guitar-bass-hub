import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../../firebase/firebase";

// Web (browser + PWA) authentication: Google sign-in through a Firebase popup.
//
// WHY POPUP IS THE RIGHT CHOICE HERE
// signInWithPopup keeps the user on the page — no full-document navigation, so
// in-progress state survives sign-in. The alternative, signInWithRedirect, is
// only needed for browsers that block popups outright and costs a page reload.
//
// WHY THIS IS THE PART THAT GETS REPLACED
// The popup mechanism is precisely what no native shell can do: it needs a
// second window plus a cross-origin postMessage back to the Firebase
// authDomain, and custom schemes (tauri://localhost, capacitor://localhost)
// cannot be registered as Firebase authorized domains.
//
// Note that only the *credential acquisition* is platform-specific. Every
// strategy — popup here, native Google Sign-In on mobile, system-browser OAuth
// on desktop — ends in the same Firebase session, so onAuthStateChanged and
// everything downstream of it stays platform-agnostic and lives in
// features/auth/AuthProvider.

const provider = new GoogleAuthProvider();

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
