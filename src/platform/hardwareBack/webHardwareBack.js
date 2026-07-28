// Hardware back button — web/desktop implementation.
//
// Selected by the `@hardware-back-impl` Vite alias for the web and Tauri targets
// (see vite.config.js). Re-exported from platform.js as subscribeToHardwareBack.
//
// A no-op, deliberately, and this is the honest answer rather than a missing
// feature. Neither a desktop browser, an installed PWA nor the Tauri window has
// a hardware back button the page can observe:
//
//   - Desktop/Tauri have no back button at all; Escape is the dismissal
//     gesture, and the modal handles that itself.
//   - An installed PWA on Android *does* get the system back gesture, but it is
//     delivered as a history pop — the only way to intercept it is to push a
//     history entry when the modal opens. That modifies routing, which the
//     modal is explicitly not allowed to do (a spurious entry also breaks the
//     back button for the rest of the session if the modal unmounts unexpectedly).
//     So the PWA keeps the browser's own behaviour: back leaves the page.
//
// The Capacitor build is where the requirement actually lives, and that is the
// build that gets a real implementation — see capacitorHardwareBack.js.

/**
 * Subscribe to the OS back gesture. Returns an unsubscribe function. The
 * callback argument is accepted and ignored on this target.
 */
export function subscribeToHardwareBack() {
	return () => {};
}
