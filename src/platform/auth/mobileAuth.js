import {
	GoogleAuthProvider,
	signInWithCredential,
	signOut as firebaseSignOut,
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth } from "../../firebase/firebase";

// Google sign-in for the Capacitor mobile build.
//
// This module is selected at build time by the `@auth-impl` Vite alias (see
// ./index.js and vite.config.js), so it only ever enters the Capacitor bundle.
// That is required: @capacitor-firebase/authentication registers a plugin at
// import time (a side effect), so it must never reach the web or Tauri bundles.
//
// WHY MOBILE NEEDS ITS OWN FLOW (web and Tauri reuse the popup; mobile cannot)
// signInWithPopup is impossible inside a mobile webview: capacitor://localhost
// fails Firebase's HTTP_REGEX protocol guard, and Google's "secure browsers"
// OAuth policy blocks WKWebView and Android WebView with disallowed_useragent —
// confirmed from current Google/Firebase docs in Phase 0 (docs/mobile-auth.md).
// So the credential comes from the native Google Sign-In, then becomes a Firebase
// session on the SAME `auth` instance the web/desktop flow uses. The resulting
// user, its uid and every request.auth.uid rule are identical across platforms —
// native packaging changes the client method, not the identity.
//
// skipNativeAuth is set in capacitor.config.json, so the plugin performs the
// Google Sign-In but does NOT sign in to the native Firebase SDK. The single
// source of truth stays the Firebase JS SDK `auth` AuthProvider listens to — no
// second session and no duplicated Firebase logic.

export async function signIn() {
	try {
		const result = await FirebaseAuthentication.signInWithGoogle();
		const idToken = result?.credential?.idToken;
		if (!idToken) {
			// No token without a throw means the user dismissed the account chooser
			// (or the native SDK returned nothing usable). There is no session to
			// establish, so treat it as a no-op — the same way the web popup treats
			// a closed window — rather than surfacing an error.
			console.warn("[auth] native Google sign-in returned no idToken");
			return;
		}
		const credential = GoogleAuthProvider.credential(idToken);
		// Same `auth` instance AuthProvider observes, so onAuthStateChanged fires
		// with a user indistinguishable from the web/desktop session.
		await signInWithCredential(auth, credential);
	} catch (err) {
		// Cancelling the native chooser is a normal user action, not a failure.
		if (!isCancellation(err)) {
			console.error("[auth] native sign-in error:", err);
		}
	}
}

export async function signOut() {
	// Sign out of the native Google session first so the next sign-in re-prompts
	// for account selection, then the Firebase JS session AuthProvider tracks.
	// The native call is best-effort: a failure there must not block clearing the
	// JS session, or the UI would show signed-in with no way out.
	try {
		await FirebaseAuthentication.signOut();
	} catch (err) {
		console.warn("[auth] native sign-out warning:", err);
	}
	try {
		await firebaseSignOut(auth);
	} catch (err) {
		console.error("[auth] sign-out error:", err);
	}
}

// The plugin surfaces user cancellation differently per platform (a "canceled"
// message on iOS, code 12501 on Android), and it is not part of a stable
// contract — so match loosely, and err on the side of staying quiet. Worst case
// a genuine error is swallowed as a cancellation; it still did not sign the user
// in, and the UI stays on SIGN IN.
function isCancellation(err) {
	const msg = String(err?.message ?? "").toLowerCase();
	const code = String(err?.code ?? "");
	return (
		msg.includes("cancel") ||
		msg.includes("dismiss") ||
		msg.includes("closed") ||
		code === "12501"
	);
}
