import {
	getFirestore,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from "firebase/firestore";
import { firebaseApp } from "./firebase";

// Firestore, split out from ./firebase so the Firestore SDK stays out of the
// entry chunk. Only modules that actually read or write data import this, and
// every one of them is reached from a lazily-loaded route — so the SDK is
// fetched in parallel with the route that needs it rather than blocking first
// paint. Keep it that way: importing this from main.jsx, App.jsx, Layout or
// AuthProvider would silently put ~200 kB back on the critical path.
//
// `db` is still a module-level constant, so callers are unchanged — no async
// getter, no await at any call site.
//
// ---------------------------------------------------------
// Persistent (IndexedDB) cache
// ---------------------------------------------------------
// Without this, a cold start with no network shows an empty catalog — fine for
// a website, reads as broken in an installed app. With it, previously loaded
// songs, backing tracks and presets render immediately from cache, and writes
// made offline are queued and replayed once the connection returns. Queries and
// listeners are unchanged: onSnapshot serves the cached result first, then the
// server result when it arrives.
//
// persistentMultipleTabManager lets several tabs share one IndexedDB cache. The
// older enableIndexedDbPersistence() allowed only a single tab and failed with
// `failed-precondition` in every other one; the modern tab manager coordinates
// instead of rejecting, so opening a second tab is a non-event.
//
// Persistence is unavailable in some environments (private-mode Safari, storage
// disabled, older WebViews). initializeFirestore can throw there, so fall back
// to an in-memory Firestore: the app keeps working exactly as it did before,
// just without the offline cache.
function createDb() {
	try {
		return initializeFirestore(firebaseApp, {
			localCache: persistentLocalCache({
				tabManager: persistentMultipleTabManager(),
			}),
		});
	} catch (err) {
		console.warn(
			"[firebase] persistent cache unavailable, using in-memory Firestore:",
			err?.code ?? err
		);
		return getFirestore(firebaseApp);
	}
}

export const db = createDb();
