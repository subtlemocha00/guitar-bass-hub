// Leaving the app — the single seam for external URLs.
//
// WHY THIS EXISTS
// No feature component should decide for itself how an external URL opens. In
// a browser that decision is trivial; in a packaged webview it is the
// difference between opening the system browser and navigating the app away
// with no way back. Centralising it means the native fix is one file.
//
// WHAT VARIES AND WHAT DOES NOT
// Only the final hand-off varies, so only that is behind the split:
//
//   webLinks.js        window.open(url, "_blank", "noopener,noreferrer")
//   tauriLinks.js      Tauri     — @tauri-apps/plugin-opener openUrl(url)
//   capacitorLinks.js  Capacitor — @capacitor/browser Browser.open({ url })
//
// URL validation, anchor attributes and click interception stay here, shared by
// every target. Duplicating the safety check per platform would be the obvious
// way for one implementation to quietly lose it.
//
// Deliberately not a React component: some call sites want an <a> they can
// style as a card, others want a plain function.

import { isWeb } from "../platform";
import * as linksImpl from "@links-impl";

// The open() implementation is chosen at BUILD TIME by the `@links-impl` Vite
// alias (see vite.config.js): webLinks for web, tauriLinks for the desktop
// build, capacitorLinks for mobile. So each build carries only its own hand-off
// and neither shell's plugin reaches the other's bundle.
//
// This is an alias rather than the source-level `isTauri ? …` this file used
// through Phase 3: the Capacitor branch imports `@capacitor/browser`, whose
// registerPlugin() side effect a static import cannot be tree-shaken past, so an
// in-source branch would leak the plugin into the web and Tauri bundles. The
// same reasoning already governs @auth-impl / @storage-impl / @lifecycle-impl.
const impl = linksImpl;

// Anything that is not http(s) or mailto is refused: `javascript:` URLs are the
// obvious hazard, but so is anything a native shell might hand to the OS. That
// second case is why this check matters more on native than on the web — here
// the URL reaches the operating system, not a sandboxed tab.
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
 * Open a URL outside the app. Resolves to false if the URL was rejected or the
 * platform refused to open it, so callers can react if they need to.
 *
 * Async because that is the only contract every target can meet: handing a URL
 * to the OS is inherently asynchronous, and the web implementation adapts to it
 * trivially while the reverse is impossible.
 */
export async function openExternal(url) {
	if (!isSafe(url)) {
		console.warn("[openExternal] refused to open unsupported URL:", url);
		return false;
	}
	try {
		return await impl.open(url);
	} catch (err) {
		console.error("[openExternal] failed to open:", url, err);
		return false;
	}
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
 * intercepted. On either packaged shell (Tauri or Capacitor) the same anchor
 * gains a click handler that delegates to openExternal, because a webview's
 * target="_blank" is denied or dead — the click has to be handed to the shell's
 * opener (Tauri) or in-app Browser (Capacitor). Call sites spread this either
 * way and never change.
 */
export function externalLinkProps(url) {
	const props = {
		href: url,
		target: "_blank",
		rel: "noopener noreferrer",
	};
	// isWeb is a build-time constant, so the web build folds to the plain object
	// (the handler tree-shakes away) and both packaged shells keep the click
	// handler. Keyed on isWeb — not isTauri — so Capacitor intercepts too.
	return isWeb ? props : { ...props, onClick: handleNativeExternalClick };
}
