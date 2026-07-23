// Native UI chrome — web / Tauri no-op implementation.
//
// Selected by the `@nativeui-impl` Vite alias for every non-Capacitor target
// (see vite.config.js). A browser tab and the Tauri desktop window own their own
// chrome — there is no mobile system status bar or soft keyboard to theme — so
// there is nothing to do. Kept as a real no-op (rather than an inline
// `if (isCapacitor)` in main.jsx) so that main.jsx can call initNativeUI()
// unconditionally while the Capacitor status-bar plugin's registerPlugin() side
// effect stays out of the web and Tauri bundles entirely.
//
// Side-effect-free and imports nothing on purpose: this file is what proves the
// web/Tauri bundles carry no status-bar code.

/** No status bar / soft keyboard to theme off a mobile shell. */
export function initNativeUI() {}
