// Single seam for leaving the app.
//
// No feature component should decide for itself how an external URL opens.
// On the web an anchor with target="_blank" is already the right answer, so
// externalLinkProps just returns those attributes and openExternal falls back
// to window.open for the imperative case.
//
// A packaged build replaces the two exported functions and nothing else:
//   - Tauri:     @tauri-apps/plugin-shell `open(url)`
//   - Capacitor: @capacitor/browser `Browser.open({ url })`
// Both need the URL handed to the host so it lands in the system browser
// instead of navigating the webview away from the app, which would strand the
// user with no back button.
//
// This is deliberately not a React component: some call sites want an <a> they
// can style as a card, others want a plain function.

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

/**
 * Attributes for an anchor that leaves the app. Spread onto an <a> so link
 * affordances (middle-click, copy address, focus order) are preserved.
 */
export function externalLinkProps(url) {
	return {
		href: url,
		target: "_blank",
		rel: "noopener noreferrer",
	};
}
