import { openUrl } from "@tauri-apps/plugin-opener";

// Tauri: hand the URL to the OS so it opens in the user's real browser.
//
// window.open cannot work here and should not. The shell answers new-window
// requests with an allow-list containing only the Firebase auth handler
// (src-tauri/src/lib.rs), so anything else silently fails — which is the
// correct outcome for an in-app browser window nobody can navigate or trust.
//
// This is the Tauri-only implementation (renamed from nativeLinks.js once
// Capacitor got its own): the `@links-impl` Vite alias picks tauriLinks for the
// desktop build and capacitorLinks for mobile, so neither shell's plugin reaches
// the other's bundle. capacitorLinks.js's Browser.open({ url }) has the same
// shape as this openUrl — which is why open() is async even though window.open
// is not: the async contract is the one every native shell can satisfy, and
// picking the synchronous one would have forced a change at every call site.
export async function open(url) {
	await openUrl(url);
	// openUrl rejects on failure rather than reporting it, so reaching here
	// means the OS accepted the URL. It cannot tell us whether a browser
	// actually appeared, which no platform reports either.
	return true;
}
