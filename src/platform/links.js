// Leaving the app — the single seam for external URLs.
//
// WHY THIS EXISTS
// No feature component should decide for itself how an external URL opens. In
// a browser that decision is trivial; in a packaged webview it is the
// difference between opening the system browser and navigating the app away
// with no way back. Centralising it means the native fix is one file.
//
// WHY IT USES THE BROWSER IMPLEMENTATION TODAY
// On the web an anchor with target="_blank" already is the correct answer, so
// externalLinkProps returns exactly those attributes and openExternal uses
// window.open for the imperative case. There is no web behaviour to improve
// on here — the value is the indirection, not a different implementation.
//
// HOW NATIVE WILL REPLACE IT
// A packaged build reimplements the two functions below and nothing else:
//   - Tauri:     @tauri-apps/plugin-shell   open(url)
//   - Capacitor: @capacitor/browser         Browser.open({ url })
// Both hand the URL to the host so it lands in the system browser. Because
// call sites only ever spread externalLinkProps() or call openExternal(), they
// do not change — swapping the window.open body below is the whole migration.
//
// The anchor-interception half is already wired: on a native build
// externalLinkProps attaches an onClick that preventDefault()s and delegates to
// openExternal, so the <a> keeps its accessibility affordances while the
// navigation is handed to the shell. On web that handler is not attached at
// all and the browser's own behaviour is untouched.
//
// Deliberately not a React component: some call sites want an <a> they can
// style as a card, others want a plain function.

import { isWeb } from "./platform";

// Anything that is not http(s) or mailto is refused: `javascript:` URLs are the
// obvious hazard, but so is anything a native shell might hand to the OS.
const SAFE_PROTOCOLS = ["http:", "https:", "mailto:"];

function parse(url) {
	if (typeof url !== "string" || url === "") return null;
	try {
		return new URL(url, window.location.href);
	} catch {
		return null;
	}
}

/**
 * True for absolute http(s) URLs — i.e. links that leave the app rather than
 * routes handled by React Router.
 */
export function isExternalUrl(url) {
	return typeof url === "string" && /^https?:\/\//i.test(url);
}

function isSafe(url) {
	const parsed = parse(url);
	return !!parsed && SAFE_PROTOCOLS.includes(parsed.protocol);
}

/**
 * Open a URL outside the app. Returns false if the URL was rejected or the
 * browser blocked the window, so callers can react if they need to.
 */
export function openExternal(url) {
	if (!isSafe(url)) {
		console.warn("[openExternal] refused to open unsupported URL:", url);
		return false;
	}
	// noopener is what keeps the opened page from reaching back through
	// window.opener; noreferrer also strips the Referer header.
	const opened = window.open(url, "_blank", "noopener,noreferrer");
	return !!opened;
}

// Intercepts an anchor activation and routes it through openExternal instead.
// Only attached on native: inside a webview, target="_blank" either does
// nothing or opens a dead blank view, so the click has to be handed to the
// shell explicitly. currentTarget.href is the browser-resolved absolute URL.
function handleNativeExternalClick(event) {
	event.preventDefault();
	openExternal(event.currentTarget.href);
}

/**
 * Attributes for an anchor that leaves the app. Spread onto an <a> so link
 * affordances (middle-click, copy address, focus order) are preserved.
 *
 * On web this returns exactly the attributes the app has always used — the
 * browser's own handling of target="_blank" is correct, so nothing is
 * intercepted. On native the same anchor gains a click handler that delegates
 * to openExternal. Call sites spread this either way and never change.
 */
export function externalLinkProps(url) {
	const props = {
		href: url,
		target: "_blank",
		rel: "noopener noreferrer",
	};
	// isWeb is a build-time constant, so the web build keeps the original
	// object and the native branch folds away entirely.
	return isWeb ? props : { ...props, onClick: handleNativeExternalClick };
}
