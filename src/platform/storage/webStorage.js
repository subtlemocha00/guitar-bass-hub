// Web storage driver — localStorage behind an asynchronous contract.
//
// WHY THE ASYNC SIGNATURES ON A SYNCHRONOUS API
// localStorage is synchronous, so every function here could have been sync.
// They are deliberately not. Capacitor Preferences and the Tauri store are
// both async, and a driver contract shaped around localStorage would be one
// they cannot implement — which is exactly the migration trap this layer
// exists to avoid. The contract is async; this driver just happens to satisfy
// it immediately.
//
// A native driver implements these three things and nothing else:
//   loadAll()          read every persisted entry, once, at startup
//   persist(key, val)  write one entry
//   KEY_PREFIX         the namespace to enumerate
//
// Capacitor: Preferences.keys() then Preferences.get() per key.
// Tauri:     store.entries().
// Both support enumeration, so loadAll() is implementable on both.

// Every key the app owns is namespaced. Hydration enumerates by this prefix
// rather than a fixed list, because per-account keys (…:{uid}) are dynamic.
export const KEY_PREFIX = "practice-hub:";

export async function loadAll() {
	const entries = [];
	try {
		for (let i = 0; i < localStorage.length; i += 1) {
			const key = localStorage.key(i);
			if (key && key.startsWith(KEY_PREFIX)) {
				entries.push([key, localStorage.getItem(key)]);
			}
		}
	} catch (err) {
		// Private mode or storage disabled. Returning what we have (usually
		// nothing) lets the app start on defaults rather than fail to render.
		console.warn("[storage] could not read persisted data:", err);
	}
	return entries;
}

export async function persist(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (err) {
		// Quota exceeded or storage disabled. The in-memory cache already holds
		// the value, so the session behaves correctly; only durability is lost.
		console.warn("[storage] could not persist", key, err);
	}
}
