// App-background flush — Capacitor (mobile) implementation.
//
// Selected by the `@lifecycle-impl` Vite alias for the Capacitor target (see
// vite.config.js). Re-exported from platform.js as subscribeToAppBackground, so
// the shared hooks (useSongNotes, useMetronomeSettingsSync) import it from there
// unchanged — the whole point of the boundary.
//
// WHY MOBILE NEEDS A DIFFERENT EVENT THAN pagehide
// When iOS/Android backgrounds an app (home button, app switcher, an incoming
// call) the webview is suspended with NO page transition, so `pagehide` never
// fires and the last debounced Firestore write — a queued song note or metronome
// setting — would be silently lost. This is the one browser assumption in the
// app that is actually wrong on mobile, not merely suboptimal
// (docs/browser-assumptions-audit.md).
//
// @capacitor/app's `appStateChange` fires on both platforms whenever the app
// moves between foreground and background, with { isActive }. Flushing on the
// background transition (isActive === false) runs before any subsequent OS kill,
// so a pending write is persisted while the app is still alive. That is exactly
// the "background then kill" path pagehide could not cover.
//
// WHY A SEPARATE FILE, SELECTED BY A BUILD ALIAS
// @capacitor/app calls registerPlugin() at import time — a side effect a static
// import cannot be tree-shaken past — so it must never enter the web or Tauri
// bundles. Same reasoning as platform/auth's @auth-impl and the Preferences
// driver. An inline `if (isCapacitor)` in platform.js would leak the plugin.

import { App } from "@capacitor/app";

/**
 * Run a callback when the app is backgrounded, so unsaved work can be flushed.
 * Returns an unsubscribe function.
 *
 * App.addListener resolves to its handle asynchronously, but the boundary's
 * contract is a synchronous unsubscribe. Both orderings are handled: if the
 * caller unsubscribes before the listener finishes registering, the handle is
 * removed as soon as it arrives.
 */
export function subscribeToAppBackground(callback) {
	let handle = null;
	let removed = false;

	App.addListener("appStateChange", ({ isActive }) => {
		// Only the foreground -> background transition means "the app is going
		// away"; isActive === true is a resume, which has nothing to flush.
		if (!isActive) callback();
	})
		.then((h) => {
			if (removed) h.remove();
			else handle = h;
		})
		.catch((err) => {
			console.warn("[lifecycle] could not register app-state listener:", err);
		});

	return () => {
		removed = true;
		if (handle) {
			handle.remove();
			handle = null;
		}
	};
}
