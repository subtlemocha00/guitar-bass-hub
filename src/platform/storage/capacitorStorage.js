// Capacitor storage driver — Capacitor Preferences behind the async contract.
//
// Same three-function contract as webStorage.js (loadAll / persist / KEY_PREFIX)
// and the same serialization: values are raw strings (the callers' own JSON),
// keys carry the same practice-hub: prefix. Only the backing store changes, so
// platform/storage/index.js and every feature module are untouched.
//
// WHY A SEPARATE FILE, SELECTED BY A BUILD ALIAS (not a source-level branch)
// @capacitor/preferences calls registerPlugin() at import time — a side effect a
// static import cannot be tree-shaken past. So this module must never enter the
// web or Tauri bundles. It is selected by the `@storage-impl` Vite alias (see
// vite.config.js and ./index.js), the same mechanism platform/auth uses for its
// plugin. An in-source `isCapacitor ? capacitorStorage : webStorage` would drag
// @capacitor/preferences into all three bundles even with the branch folded.
//
// WHY PREFERENCES RATHER THAN localStorage IN THE WEBVIEW
// A mobile webview does expose localStorage, but the OS can evict it under
// storage pressure with no warning — exactly the durability the persisted setup
// and (signed-out) presets must not lose. Preferences is backed by the native
// key/value store (UserDefaults on iOS, SharedPreferences on Android), which is
// not part of the evictable web-storage bucket. The async contract this layer
// was built around (see storage.md) exists precisely so this swap costs nothing
// above the driver.

import { Preferences } from "@capacitor/preferences";

// Every key the app owns is namespaced. Hydration enumerates by this prefix
// rather than a fixed list, because per-account keys (…:{uid}) are dynamic.
// Must match webStorage.js so data written under one target's prefix is found
// by the other's enumeration.
export const KEY_PREFIX = "practice-hub:";

export async function loadAll() {
	const entries = [];
	try {
		// Preferences has no bulk read, so enumerate keys then fetch each. This is
		// the one real cost of the native driver — a handful of async reads at
		// startup — and it is why storage hydrates before first paint (storage.md).
		const { keys } = await Preferences.keys();
		const wanted = keys.filter((key) => key.startsWith(KEY_PREFIX));
		const values = await Promise.all(
			wanted.map((key) => Preferences.get({ key }))
		);
		wanted.forEach((key, i) => {
			const value = values[i]?.value;
			// Match webStorage: only string values enter the cache. Preferences
			// returns null for an absent key; index.js also guards on typeof.
			if (typeof value === "string") entries.push([key, value]);
		});
	} catch (err) {
		// Mirror webStorage's failure posture: return what we have (usually
		// nothing) so the app starts on defaults rather than failing to render.
		console.warn("[storage] could not read persisted data:", err);
	}
	return entries;
}

export async function persist(key, value) {
	try {
		await Preferences.set({ key, value });
	} catch (err) {
		// The in-memory cache already holds the value, so the session behaves
		// correctly; only durability is lost. Same contract as webStorage.
		console.warn("[storage] could not persist", key, err);
	}
}
