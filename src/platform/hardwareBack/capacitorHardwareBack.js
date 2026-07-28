// Hardware back button — Capacitor (mobile) implementation.
//
// Selected by the `@hardware-back-impl` Vite alias for the Capacitor target (see
// vite.config.js). Re-exported from platform.js as subscribeToHardwareBack, so
// UI components import it from there and never touch @capacitor/app.
//
// WHY A SEPARATE FILE, SELECTED BY A BUILD ALIAS
// @capacitor/app calls registerPlugin() at import time — a side effect a static
// import cannot be tree-shaken past — so it must never enter the web or Tauri
// bundles. Same reasoning as @lifecycle-impl, @auth-impl and @storage-impl.
//
// WHY SUBSCRIPTION MUST BE SCOPED TO "SOMETHING IS OPEN"
// Capacitor suppresses the default back behaviour (webview history back, or
// exiting the app from the root) for as long as ANY `backButton` listener is
// registered — a listener does not observe the press, it *replaces* the
// handling of it. So a globally-registered listener would silently break normal
// back navigation across the whole app.
//
// Callers therefore subscribe only while their dismissible surface is open and
// unsubscribe as it closes. While a modal is up, back closes the modal; once it
// is down there is no listener and Android's default behaviour is restored
// untouched. That is also exactly the requirement: "Android Back closes the
// modal instead of navigating away".

import { App } from "@capacitor/app";

/**
 * Run a callback when the Android hardware/gesture back is pressed. Returns an
 * unsubscribe function.
 *
 * App.addListener resolves to its handle asynchronously while the boundary's
 * contract is a synchronous unsubscribe, so both orderings are handled: if the
 * caller unsubscribes before registration completes, the handle is removed as
 * soon as it arrives. Mirrors capacitorLifecycle.js.
 */
export function subscribeToHardwareBack(callback) {
	let handle = null;
	let removed = false;

	App.addListener("backButton", () => {
		callback();
	})
		.then((h) => {
			if (removed) h.remove();
			else handle = h;
		})
		.catch((err) => {
			console.warn("[hardwareBack] could not register back listener:", err);
		});

	return () => {
		removed = true;
		if (handle) {
			handle.remove();
			handle = null;
		}
	};
}
