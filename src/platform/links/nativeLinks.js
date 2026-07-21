import { openUrl } from "@tauri-apps/plugin-opener";

// Tauri: hand the URL to the OS so it opens in the user's real browser.
//
// window.open cannot work here and should not. The shell answers new-window
// requests with an allow-list containing only the Firebase auth handler
// (src-tauri/src/lib.rs), so anything else silently fails — which is the
// correct outcome for an in-app browser window nobody can navigate or trust.
//
// Capacitor will replace this file, not the caller: @capacitor/browser's
// Browser.open({ url }) has the same shape. That is why open() is async even
// though window.open is not — the async contract is the one every native shell
// can satisfy, and picking the synchronous one would have forced a change at
// every call site later.
export async function open(url) {
	await openUrl(url);
	// openUrl rejects on failure rather than reporting it, so reaching here
	// means the OS accepted the URL. It cannot tell us whether a browser
	// actually appeared, which no platform reports either.
	return true;
}
