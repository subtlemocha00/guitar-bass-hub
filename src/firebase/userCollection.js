import {
	collection,
	addDoc,
	deleteDoc,
	doc,
	setDoc,
	onSnapshot,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "./db";

function pickAllowed(obj, allowed) {
	if (!allowed) return obj;
	return Object.fromEntries(
		Object.entries(obj).filter(([k]) => allowed.includes(k))
	);
}

// Firestore error codes mapped to text that is safe to show a user: no uids,
// no document paths, no raw SDK internals. The full error is always logged.
const MESSAGES = {
	"permission-denied": "You do not have permission to save this change.",
	unauthenticated: "Your session expired. Sign in again to save changes.",
	unavailable: "Could not reach the server. Check your connection and retry.",
	"deadline-exceeded": "The server took too long to respond. Try again.",
	"resource-exhausted": "Too many changes at once. Wait a moment and retry.",
};

function failure(name, operation, err) {
	// Full detail to the console for debugging; only the safe message escapes.
	console.warn(`[userCollection:${name}] ${operation} error:`, err);
	const code = err?.code ?? "unknown";
	return {
		ok: false,
		code,
		message: MESSAGES[code] ?? "Something went wrong saving your changes.",
	};
}

/**
 * Builds the CRUD surface for one per-user subcollection at
 * users/{uid}/{name}.
 *
 * Writes never throw. They resolve to a result object so callers can react
 * without every call site needing a try/catch:
 *
 *   const result = await addSong(uid, data);
 *   if (!result.ok) showError(result.message);
 *
 *   add    -> { ok: true, id } | { ok: false, code, message }
 *   remove -> { ok: true }     | { ok: false, code, message }
 *   update -> { ok: true }     | { ok: false, code, message }
 *
 * Callers that genuinely don't care (optimistic UI a snapshot will correct
 * anyway) can keep ignoring the return value.
 */
export function createUserCollection({ name, mapDoc, allowedFields }) {
	const colRef = (uid) => collection(db, "users", uid, name);
	const docRef = (uid, id) => doc(db, "users", uid, name, id);

	async function add(uid, data) {
		try {
			const ref = await addDoc(colRef(uid), {
				...data,
				createdAt: serverTimestamp(),
			});
			return { ok: true, id: ref.id };
		} catch (err) {
			return failure(name, "add", err);
		}
	}

	async function remove(uid, id) {
		try {
			await deleteDoc(docRef(uid, id));
			return { ok: true };
		} catch (err) {
			return failure(name, "remove", err);
		}
	}

	async function update(uid, id, updates) {
		try {
			const safe = pickAllowed(updates, allowedFields);
			await setDoc(docRef(uid, id), safe, { merge: true });
			return { ok: true };
		} catch (err) {
			return failure(name, "update", err);
		}
	}

	/**
	 * Subscribe to the collection. Returns the unsubscribe function.
	 *
	 * The onSnapshot error callback matters: listener failures (revoked
	 * permissions, an expired token) surface asynchronously and would otherwise
	 * be swallowed entirely — the try/catch below only ever caught the
	 * synchronous setup call.
	 */
	function subscribe(uid, callback) {
		try {
			return onSnapshot(
				colRef(uid),
				(snap) => {
					callback(snap.docs.map((d) => mapDoc(d)));
				},
				(err) => {
					console.warn(`[userCollection:${name}] subscribe error:`, err);
				}
			);
		} catch (err) {
			console.warn(`[userCollection:${name}] subscribe error:`, err);
			return () => {};
		}
	}

	return { add, remove, update, subscribe };
}
