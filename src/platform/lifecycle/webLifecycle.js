// App-background flush — web/desktop implementation.
//
// Selected by the `@lifecycle-impl` Vite alias for the web and Tauri targets
// (see vite.config.js). Re-exported from platform.js as subscribeToAppBackground,
// so the shared hooks import it from there unchanged.
//
// Uses `pagehide`. Chosen over `beforeunload`, which is unreliable inside
// webviews and never fires on iOS Safari; `pagehide` covers tab close,
// navigation and bfcache eviction, and Tauri fires it normally when the window
// closes (verified in the desktop lifecycle pass — docs/desktop-polish.md).
//
// This is deliberately its own file rather than an inline branch in platform.js:
// its mobile counterpart imports @capacitor/app, whose registerPlugin() side
// effect must stay out of the web/Tauri bundles — see capacitorLifecycle.js.

/**
 * Run a callback when the app is about to be backgrounded or closed, so unsaved
 * work can be flushed. Returns an unsubscribe function.
 */
export function subscribeToAppBackground(callback) {
	if (typeof window === "undefined") return () => {};
	const onPageHide = () => callback();
	window.addEventListener("pagehide", onPageHide);
	return () => window.removeEventListener("pagehide", onPageHide);
}
