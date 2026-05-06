import {
	collection,
	addDoc,
	deleteDoc,
	doc,
	setDoc,
	onSnapshot,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

function songsCol(uid) {
	return collection(db, "users", uid, "songs");
}

export async function addSong(uid, songData) {
	try {
		const ref = await addDoc(songsCol(uid), {
			title: songData.title,
			artist: songData.artist,
			tabUrl: songData.tabUrl,
			youtubeUrl: songData.youtubeUrl ?? null,
			status: "planned",
			note: "",
			createdAt: serverTimestamp(),
		});
		return ref.id;
	} catch (err) {
		console.warn("[firebaseSongs] error:", err);
	}
}

export async function removeSong(uid, songId) {
	try {
		await deleteDoc(doc(db, "users", uid, "songs", songId));
	} catch (err) {
		console.warn("[firebaseSongs] error:", err);
	}
}

// setDoc with merge so it works as an upsert — static songs never go through
// addSong, so their documents don't exist yet when status/note is first set.
export async function updateSong(uid, songId, updates) {
	try {
		const allowed = ["title", "artist", "tabUrl", "youtubeUrl", "status", "note"];
		const safe = Object.fromEntries(
			Object.entries(updates).filter(([k]) => allowed.includes(k))
		);
		await setDoc(doc(db, "users", uid, "songs", songId), safe, { merge: true });
	} catch (err) {
		console.warn("[firebaseSongs] error:", err);
	}
}

// No orderBy — documents created via setDoc (static songs) won't have
// createdAt, and Firestore silently excludes docs missing an ordered field.
export function subscribeToSongs(uid, callback) {
	try {
		return onSnapshot(songsCol(uid), (snap) => {
			const songs = snap.docs.map((d) => ({
				id: d.id,
				title: d.data().title ?? "",
				artist: d.data().artist ?? "",
				tabUrl: d.data().tabUrl ?? "",
				youtubeUrl: d.data().youtubeUrl ?? null,
				status: d.data().status ?? "planned",
				note: d.data().note ?? "",
			}));
			callback(songs);
		});
	} catch (err) {
		console.warn("[firebaseSongs] error:", err);
		return () => {};
	}
}
