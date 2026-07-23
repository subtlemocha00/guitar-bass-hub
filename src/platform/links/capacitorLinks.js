import { Browser } from "@capacitor/browser";

// Capacitor: open the URL in the platform's in-app browser (SFSafariViewController
// on iOS, Custom Tabs on Android) rather than navigating the app's own webview.
//
// A packaged Capacitor app is a single WebView. A plain window.open / target=
// "_blank" either does nothing or replaces the app's own document with the remote
// page, stranding the user with no way back — the same failure Tauri has, for the
// same reason. Browser.open hands the URL to the OS's in-app browser component,
// which overlays the app and returns to it on dismiss. This is why the shared
// index.js intercepts external-link clicks on native (see externalLinkProps).
//
// Same open(url) contract as webLinks.js and tauriLinks.js — this file is
// swapped in for those by the `@links-impl` Vite alias, so the caller never
// changes. It is an alias rather than a source-level `isCapacitor ? …` branch
// because `@capacitor/browser` calls registerPlugin() at import time, a side
// effect a static import cannot be tree-shaken past; the alias keeps the plugin
// out of the web and Tauri bundles entirely (see vite.config.js and the
// alias reasoning shared with @auth-impl / @storage-impl / @lifecycle-impl).
export async function open(url) {
	await Browser.open({ url });
	// Browser.open resolves once the in-app browser has been asked to present and
	// rejects on failure, so reaching here means the OS accepted the URL. Like
	// every other target it cannot report whether the user actually saw a page.
	return true;
}
