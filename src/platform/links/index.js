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
//   webLinks.js     window.open(url, "_blank", "noopener,noreferrer")
//   nativeLinks.js  Tauri  — @tauri-apps/plugin-opener openUrl(url)
//                   future: Capacitor — @capacitor/browser Browser.open({ url })
//
// URL validation, anchor attributes and click interception stay here, shared by
// every target. Duplicating the safety check per platform would be the obvious
// way for one implementation to quietly lose it.
//
// Deliberately not a React component: some call sites want an <a> they can
// style as a card, others want a plain function.

import { isTauri } from "../platform";
import * as webLinks from "./webLinks";
import * as nativeLinks from "./nativeLinks";

// isTauri is a build-time constant, so each build keeps only its own
// implementation and the others fold away — only the Tauri build carries the
// Tauri opener plugin. Web and Capacitor both use webLinks for now; selecting on
// isTauri (rather than "not web") is what keeps the Tauri opener out of the
// mobile bundle. Capacitor gets its own @capacitor/browser implementation in a
// later phase — a new sibling module selected here, not a fall-through to
// nativeLinks.
const impl = isTauri ? nativeLinks : webLinks;

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
 * On web (and Capacitor for now) this returns exactly the attributes the app has
 * always used — the browser's own handling of target="_blank" is correct, so
 * nothing is intercepted. On Tauri the same anchor gains a click handler that
 * delegates to openExternal, because window.open is denied there. Call sites
 * spread this either way and never change; Capacitor's interception arrives with
 * its links implementation in a later phase.
 */
export function externalLinkProps(url) {
	const props = {
		href: url,
		target: "_blank",
		rel: "noopener noreferrer",
	};
	// isTauri is a build-time constant, so only the Tauri build keeps the click
	// handler and the other targets fold to the plain object.
	return isTauri ? { ...props, onClick: handleNativeExternalClick } : props;
}
