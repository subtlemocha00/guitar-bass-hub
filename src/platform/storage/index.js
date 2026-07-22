// The concrete storage driver is chosen at BUILD TIME by the `@storage-impl`
// Vite alias (see resolve.alias in vite.config.js):
//   web + Tauri desktop -> ./webStorage       (localStorage)
//   Capacitor mobile    -> ./capacitorStorage (Capacitor Preferences)
// so only the selected driver enters each bundle. It is an alias rather than a
// source-level `isCapacitor ? … : …` because @capacitor/preferences registers a
// plugin at import time — a side effect a static import cannot be tree-shaken
// past (same reasoning as platform/auth's @auth-impl). Every driver exports the
// same loadAll / persist / KEY_PREFIX contract, so nothing below this line cares
// which one it is.
import * as driver from "@storage-impl";
import { KEY_PREFIX } from "@storage-impl";

// Storage hydration layer.
//
// THE PROBLEM THIS SOLVES
// Three call sites read storage to seed React's *initial* state:
//   Metronome.jsx        useState(loadMetronomeSettings)
//   MetronomePresets.jsx useState(() => listPresets())
//   useSortPreference.js useState(() => readLocal(instrument))
// They need an answer during the first render. localStorage can give one;
// Capacitor Preferences and the Tauri store cannot — they are async. Wrapping
// an async store in a sync-looking get() would mean returning stale or empty
// data on first read, so the metronome would paint at 120/4 defaults and then
// snap to the stored setup. A visible flash, i.e. a behaviour regression.
//
// THE SHAPE THAT AVOIDS IT
// Move the asynchrony to startup instead of to the call sites:
//
//   1. hydrateStorage()  awaits the driver once, before the app renders
//   2. readItem()        synchronous, straight out of the in-memory cache
//   3. writeItem()       updates the cache synchronously, persists in the
//                        background
//
// Features keep their existing synchronous shape, and the only async step
// happens before anything can observe it. Swapping the driver for an async
// native one changes nothing above this file.
//
// Reads and writes are strings, mirroring localStorage's contract, so the
// callers' existing JSON parsing and validation are untouched.

// key -> string. The single source of truth once hydrated.
const cache = new Map();

let hydrated = false;
let hydrating = null;
let warnedEarlyRead = false;

/**
 * Load persisted data into memory. Call once, before rendering.
 *
 * Never rejects: if storage is unreadable the app starts on defaults rather
 * than failing to render at all. Idempotent, so StrictMode and HMR are safe.
 */
export function hydrateStorage() {
	if (hydrated) return Promise.resolve();
	if (hydrating) return hydrating;

	hydrating = driver
		.loadAll()
		.then((entries) => {
			for (const [key, value] of entries) {
				if (typeof value === "string") cache.set(key, value);
			}
		})
		.catch((err) => {
			console.warn("[storage] hydration failed, starting on defaults:", err);
		})
		.finally(() => {
			hydrated = true;
			hydrating = null;
		});

	return hydrating;
}

/**
 * Read a value synchronously. Returns null when absent, matching what
 * localStorage.getItem() returned, so callers' `if (!raw)` checks still hold.
 */
export function readItem(key) {
	if (!hydrated && !warnedEarlyRead) {
		warnedEarlyRead = true;
		// Reading before hydration yields defaults and would silently overwrite
		// real data on the next write. That is an ordering bug in startup, not
		// a recoverable condition, so make it loud.
		console.warn(
			"[storage] read before hydrateStorage() completed — startup ordering bug:",
			key
		);
	}
	return cache.get(key) ?? null;
}

/**
 * Write a value. The cache updates synchronously so an immediately following
 * readItem() sees it; persistence happens in the background and never blocks
 * the caller. Persistence failures are logged by the driver, not thrown —
 * matching the existing behaviour, where a failed write never broke the UI.
 */
export function writeItem(key, value) {
	if (!key.startsWith(KEY_PREFIX)) {
		// Un-namespaced keys would not be picked up by the next hydration, so
		// the value would silently vanish on reload.
		console.warn(`[storage] key is missing the "${KEY_PREFIX}" prefix:`, key);
	}
	cache.set(key, value);
	driver.persist(key, value);
}

// No removeItem: nothing in the app deletes a key today (preset deletion
// rewrites the whole list). Adding one would be an unused code path.
