import {
	collection,
	addDoc,
	deleteDoc,
	doc,
	setDoc,
	onSnapshot,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

function pickAllowed(obj, allowed) {
	if (!allowed) return obj;
	return Object.fromEntries(
		Object.entries(obj).filter(([k]) => allowed.includes(k))
	);
}

export function createUserCollection({ name, mapDoc, allowedFields }) {
	const colRef = (uid) => collection(db, "users", uid, name);
	const docRef = (uid, id) => doc(db, "users", uid, name, id);

	async function add(uid, data) {
		try {
			const ref = await addDoc(colRef(uid), {
				...data,
				createdAt: serverTimestamp(),
			});
			return ref.id;
		} catch (err) {
			console.warn(`[userCollection:${name}] add error:`, err);
		}
	}

	async function remove(uid, id) {
		try {
			await deleteDoc(docRef(uid, id));
		} catch (err) {
			console.warn(`[userCollection:${name}] remove error:`, err);
		}
	}

	async function update(uid, id, updates) {
		try {
			const safe = pickAllowed(updates, allowedFields);
			await setDoc(docRef(uid, id), safe, { merge: true });
		} catch (err) {
			console.warn(`[userCollection:${name}] update error:`, err);
		}
	}

	function subscribe(uid, callback) {
		try {
			return onSnapshot(colRef(uid), (snap) => {
				callback(snap.docs.map((d) => mapDoc(d)));
			});
		} catch (err) {
			console.warn(`[userCollection:${name}] subscribe error:`, err);
			return () => {};
		}
	}

	return { add, remove, update, subscribe };
}
