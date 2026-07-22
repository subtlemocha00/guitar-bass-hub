// Which platform the app is running on.
//
// WHY THIS EXISTS
// Several places need to know "am I in a browser or a packaged shell?" before
// they can behave correctly — external links, storage durability, and the
// Control Center's PWA readout (display-mode and serviceWorker.controller are
// meaningful on the web and meaningless inside a native shell). Without a
// single source of truth each of those grows its own sniffing logic, which is
// exactly the widespread refactor this layer is meant to avoid.
//
// WHY IT REPORTS WEB TODAY
// The only shipping artifact is the web/PWA build, so every value below
// resolves to the web answer. Nothing is faked or stubbed: BUILD_TARGET is the
// real compile-time flag already set by vite.config.js, and the rest is
// derived from it.
//
// THREE COMPILE-TIME TARGETS
// BUILD_TARGET is a build-time define, so isWeb / isTauri / isCapacitor each
// fold to a literal boolean and the bundler eliminates the dead branches: the
// web bundle carries no Tauri/Capacitor code, the Tauri bundle no Capacitor
// code, and the Capacitor bundle no Tauri code. Verified per bundle, not
// assumed.
//
// Select platform implementations with these booleans, NEVER with
// `platform() === "capacitor"`: a function-return comparison is not statically
// foldable, so it would defeat tree-shaking and leak one shell's plugins into
// another's bundle. `platform()` below is for runtime *information* only.
//
// The one thing the build target cannot answer is ios vs android — both share
// the single "capacitor" bundle. That split is a runtime read of the
// Capacitor-injected `window.Capacitor` global (see platform()), not a build
// flag and not a package import.

// Set by vite.config.js: "web" (default build), "native" (`build:native`,
// Tauri — legacy name), "capacitor" (`build:capacitor`). The fallback keeps
// this safe if the define is ever missing (e.g. a test runner that does not
// load the Vite config).
export const BUILD_TARGET = import.meta.env.VITE_BUILD_TARGET ?? "web";

export const isWeb = BUILD_TARGET === "web";
export const isTauri = BUILD_TARGET === "native"; // Tauri desktop (historical target name)
export const isCapacitor = BUILD_TARGET === "capacitor";

// "Any packaged shell" — the browser-vs-app distinction the environment checks
// below care about (standalone, service worker, storage durability). Kept
// deliberately non-specific: true for both Tauri and Capacitor, so callers that
// only ask "am I in a browser or an app?" keep working unchanged.
export const isNative = !isWeb;

/**
 * The app version, injected from package.json by vite.config.js.
 *
 * Here rather than read from package.json at each call site because it is the
 * same kind of build-time environment fact as BUILD_TARGET. Every packaged
 * target needs it for the same reason: a user reporting a bug in an installed
 * app cannot look at a URL to tell you which build they have.
 */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";

/**
 * The platform the app is currently running on: "web" | "desktop" | "ios" |
 * "android". For runtime *information* (labels, telemetry) — prefer the
 * compile-time isWeb/isTauri/isCapacitor booleans for selecting implementations,
 * because those fold at build time and this call does not.
 */
export function platform() {
	if (isTauri) return "desktop";
	if (isCapacitor) {
		// ios vs android is the only split not known at build time — both share
		// the "capacitor" bundle. Read the Capacitor-injected global rather than
		// importing @capacitor/core, so no Capacitor package reference is pulled
		// into the bundle. Outside a device (e.g. a browser preview of the
		// capacitor build) the global is absent and this reports "ios".
		const p =
			typeof window !== "undefined" ? window.Capacitor?.getPlatform?.() : undefined;
		return p === "android" ? "android" : "ios";
	}
	return "web";
}

/**
 * How the app is running, for display. "BROWSER" / "INSTALLED PWA" /
 * "DESKTOP (TAURI)" / "MOBILE (IOS)" / "MOBILE (ANDROID)".
 *
 * Exists because the Control Center's status card was describing a *browser*
 * on desktop: isStandalone() is true there, so it read "STANDALONE / PWA",
 * and "SERVICE WORKER: INACTIVE" implied something was broken rather than
 * inapplicable. The distinction the panel needs is not display-mode, it is
 * which shell. The web case keeps its BROWSER vs INSTALLED PWA detail; the two
 * packaged shells report themselves. Must branch on isTauri/isCapacitor, not
 * isNative, now that isNative covers both.
 */
export function runtimeLabel() {
	if (isTauri) return "DESKTOP (TAURI)";
	if (isCapacitor) return platform() === "android" ? "MOBILE (ANDROID)" : "MOBILE (IOS)";
	return isStandalone() ? "INSTALLED PWA" : "BROWSER";
}

// ---------------------------------------------------------
// Environment capabilities
//
// These answer "what environment am I running in?", which is why they live
// here rather than in the one component that reads them. Each is included
// because its answer genuinely changes on native — a wrapper that would return
// the same value everywhere would be pure indirection and is deliberately
// absent (see the note on import.meta.env.PROD at the bottom of this file).
// ---------------------------------------------------------

/**
 * Is the app running in its own app-like window rather than a browser tab?
 *
 * Web: true once the PWA is installed. `window.navigator.standalone` is the
 * iOS Safari legacy flag, kept because iOS did not support the display-mode
 * media query for a long time.
 *
 * Native: always true — a packaged app has no browser chrome. A shell can
 * return `true` directly and drop the media query entirely.
 */
export function isStandalone() {
	if (isNative) return true;
	if (typeof window === "undefined") return false;
	return (
		window.matchMedia?.("(display-mode: standalone)").matches ||
		window.navigator.standalone === true
	);
}

/**
 * Is a service worker currently controlling the page?
 *
 * Web: true once the worker has claimed the client, so the app shell is being
 * served from the cache.
 *
 * Native: always false. Native builds omit vite-plugin-pwa entirely, and a
 * service worker is unsupported on iOS WKWebView custom schemes — so this is
 * not "not yet registered", it is "cannot exist". Callers that use this to
 * mean "am I offline-capable?" will need rethinking on native, where assets
 * are always local.
 */
export function isServiceWorkerActive() {
	if (isNative) return false;
	return (
		typeof navigator !== "undefined" &&
		"serviceWorker" in navigator &&
		!!navigator.serviceWorker.controller
	);
}

/**
 * Current network reachability.
 *
 * Native replacement: @capacitor/network reports more accurately than
 * navigator.onLine inside a webview, where onLine can report true for a
 * captive portal or a disconnected interface.
 */
export function isOnline() {
	return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function.
 *
 * Paired with isOnline() so a caller never has to touch window events. The
 * subscribe/unsubscribe shape is what Capacitor's Network.addListener returns
 * too, so swapping the implementation will not change how callers use it.
 */
export function subscribeToOnline(callback) {
	if (typeof window === "undefined") return () => {};
	const onOnline = () => callback(true);
	const onOffline = () => callback(false);
	window.addEventListener("online", onOnline);
	window.addEventListener("offline", onOffline);
	return () => {
		window.removeEventListener("online", onOnline);
		window.removeEventListener("offline", onOffline);
	};
}

/**
 * Run a callback when the app is about to be backgrounded or closed, so unsaved
 * work can be flushed. Returns an unsubscribe function.
 *
 * Exists because two features (song notes, live metronome settings) debounce
 * their writes and must not lose a queued edit when the app goes away. Both
 * reached for `pagehide` independently; this is the single boundary for that
 * one concern.
 *
 * Web/desktop: `pagehide`. Chosen over `beforeunload`, which is unreliable
 * inside webviews and never fires on iOS Safari; `pagehide` covers tab close,
 * navigation, and bfcache eviction, and Tauri fires it normally when the window
 * closes.
 *
 * Native replacement point: `pagehide` does NOT fire when a mobile OS
 * backgrounds an app (home button, app switcher, an incoming call) — the
 * webview is suspended with no page transition, so a queued edit would be lost.
 * Capacitor's `@capacitor/app` `App.addListener("pause", …)` (paired with
 * `appStateChange`) is the event that fires there, and is the one line to swap
 * in. This is why the concern is wrapped rather than inlined: it is the single
 * browser assumption in the app that is actually wrong on mobile, not merely
 * suboptimal.
 */
export function subscribeToAppBackground(callback) {
	if (typeof window === "undefined") return () => {};
	const onPageHide = () => callback();
	window.addEventListener("pagehide", onPageHide);
	return () => window.removeEventListener("pagehide", onPageHide);
}

// Deliberately NOT wrapped: import.meta.env.PROD / BASE_URL. Vite resolves
// both at build time and they behave identically for every target, so a
// platform helper would add indirection without a replacement point.
