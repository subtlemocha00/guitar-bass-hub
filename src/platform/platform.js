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
// HOW NATIVE WILL EXTEND IT
// BUILD_TARGET already becomes "native" for `npm run build:native`, so isNative
// starts working the moment a shell is added — no change needed here. What
// this file cannot yet answer is *which* native platform, because that needs a
// runtime probe of a shell that is not installed:
//
//   Tauri      window.__TAURI_INTERNALS__ is defined
//   Capacitor  window.Capacitor?.getPlatform() returns "ios" | "android"
//
// Deliberately not guessed at now — a probe for an absent global would be
// untestable and would silently rot. When a shell is installed, `platform()`
// below is the one function to extend, widening its return type from
// "web" | "native" to "web" | "desktop" | "ios" | "android". Everything that
// only asks isWeb/isNative keeps working unchanged.

// Set by vite.config.js: "web" for the default build, "native" for
// `npm run build:native`. The fallback keeps this safe if the define is ever
// missing (e.g. a test runner that does not load the Vite config).
export const BUILD_TARGET = import.meta.env.VITE_BUILD_TARGET ?? "web";

export const isNative = BUILD_TARGET === "native";
export const isWeb = !isNative;

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
 * The platform the app is currently running on.
 *
 * Returns "web" today. A native shell widens this to the specific platform;
 * prefer isWeb/isNative unless you genuinely need to tell desktop from mobile.
 */
export function platform() {
	return isNative ? "native" : "web";
}

/**
 * How the app is running, for display. "BROWSER" / "INSTALLED PWA" /
 * "DESKTOP (TAURI)".
 *
 * Exists because the Control Center's status card was describing a *browser*
 * on desktop: isStandalone() is true there, so it read "STANDALONE / PWA",
 * and "SERVICE WORKER: INACTIVE" implied something was broken rather than
 * inapplicable. The distinction the panel needs is not display-mode, it is
 * which shell — so that is what this answers, and it is the single line
 * Capacitor will extend to "MOBILE (IOS)" / "MOBILE (ANDROID)".
 */
export function runtimeLabel() {
	if (isNative) return "DESKTOP (TAURI)";
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

// Deliberately NOT wrapped: import.meta.env.PROD / BASE_URL. Vite resolves
// both at build time and they behave identically for every target, so a
// platform helper would add indirection without a replacement point.
