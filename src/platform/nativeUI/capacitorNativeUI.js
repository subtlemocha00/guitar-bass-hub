// Native UI chrome — Capacitor (mobile) implementation.
//
// Selected by the `@nativeui-impl` Vite alias for the Capacitor target (see
// vite.config.js) and re-exported from platform.js as initNativeUI(), which
// main.jsx calls once at startup. Web and Tauri get the no-op webNativeUI.js.
//
// WHAT THIS OWNS
// The one thing a mobile shell has that a browser tab and a desktop window do
// not: a system status bar whose icon colour and background must be themed to
// match the app. The synthwave UI is permanently dark, so the status bar needs
// LIGHT icons, and on Android a matching dark bar.
//
// WHY A SEPARATE FILE, SELECTED BY A BUILD ALIAS
// @capacitor/status-bar calls registerPlugin() at import time — a side effect a
// static import cannot be tree-shaken past — so it must never enter the web or
// Tauri bundles. Same reasoning as @auth-impl / @storage-impl / @lifecycle-impl /
// @links-impl. An inline `if (isCapacitor)` in platform.js or main.jsx would
// leak the plugin into the browser and desktop builds.
//
// WHY THE KEYBOARD PLUGIN IS NOT IMPORTED HERE
// @capacitor/keyboard is installed and synced, but it is a NATIVE-ONLY concern:
// its default `resize: "native"` mode (which resizes the whole WebView when the
// keyboard opens, so a position:fixed modal reflows above the keyboard instead
// of being covered — the fix deferred by docs/mobile-readiness-audit.md) is
// applied entirely by the native plugin once it is present. It needs no JS, so
// importing it would only pull a registerPlugin() side effect into the bundle
// for nothing. Its dark keyboard appearance is set declaratively in
// capacitor.config.json instead. See docs/mobile-readiness-audit.md.

import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// The app's real painted background (index.css --bg-0). Kept in sync with the
// webview `backgroundColor` and the native launch screens so the status bar,
// splash and first paint are one continuous dark surface — no seams.
const THEME_BG = "#05021f";

/**
 * Theme the native status bar to match the dark synthwave UI. Idempotent and
 * safe to call once at startup. Resolves when done; never rejects — a status-bar
 * failure must not stop the app from rendering.
 */
export async function initNativeUI() {
	try {
		// Style.Dark means "light text for dark backgrounds" (the plugin's naming is
		// about the background, not the icons) — i.e. the light icons a dark app
		// needs. Set here as well as in capacitor.config.json so it holds after the
		// Android overlay change below re-evaluates the foreground colour.
		await StatusBar.setStyle({ style: Style.Dark });

		// iOS keeps the status bar as a translucent overlay (its platform
		// convention): the WebView already extends underneath it and the topbar /
		// page CSS pads env(safe-area-inset-top) to stay clear (see the safe-area
		// work in docs/mobile-readiness-audit.md). Android's convention is a solid
		// bar, so there we turn the overlay off and paint the bar the theme colour —
		// which also avoids relying on Android's less reliable safe-area insets and
		// sidesteps the documented Android full-screen keyboard-resize bug.
		if (Capacitor.getPlatform() === "android") {
			await StatusBar.setOverlaysWebView({ overlays: false });
			await StatusBar.setBackgroundColor({ color: THEME_BG });
		}
	} catch (err) {
		console.warn("[nativeUI] status bar theming skipped:", err);
	}
}
