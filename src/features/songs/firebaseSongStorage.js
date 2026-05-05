import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

const STATUSES = ["planned", "learning", "completed"];

function userDoc(uid) {
	return doc(db, "users", uid);
}

export async function getStatus(uid, songId) {
	const snap = await getDoc(userDoc(uid));
	if (!snap.exists()) return null;
	const value = snap.data()?.statuses?.[songId];
	return STATUSES.includes(value) ? value : null;
}

export async function setStatus(uid, songId, status) {
	if (!STATUSES.includes(status)) {
		throw new Error(`Invalid song status: ${status}`);
	}
	await setDoc(
		userDoc(uid),
		{ statuses: { [songId]: status } },
		{ merge: true }
	);
}

export async function getNote(uid, songId) {
	const snap = await getDoc(userDoc(uid));
	if (!snap.exists()) return null;
	const value = snap.data()?.notes?.[songId];
	return typeof value === "string" ? value : null;
}

export async function setNote(uid, songId, note) {
	await setDoc(
		userDoc(uid),
		{ notes: { [songId]: note } },
		{ merge: true }
	);
}

export function subscribeToUserData(uid, callback) {
	return onSnapshot(
		userDoc(uid),
		(snap) => {
			if (snap.metadata.hasPendingWrites) return;
			if (!snap.exists()) {
				callback({ statuses: {}, notes: {} });
				return;
			}
			const data = snap.data() ?? {};
			callback({
				statuses: data.statuses ?? {},
				notes: data.notes ?? {},
			});
		},
		(err) => {
			console.error("[firebaseSongStorage] subscription error:", err);
		}
	);
}
