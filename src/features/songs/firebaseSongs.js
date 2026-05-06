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
			instrument: songData.instrument ?? null,
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
		const allowed = [
			"title",
			"artist",
			"tabUrl",
			"youtubeUrl",
			"status",
			"note",
		];
		const safe = Object.fromEntries(
			Object.entries(updates).filter(([k]) => allowed.includes(k))
		);
		await setDoc(doc(db, "users", uid, "songs", songId), safe, {
			merge: true,
		});
	} catch (err) {
		console.warn("[firebaseSongs] error:", err);
	}
}

// No orderBy — documents created via setDoc (static songs) won't have
// createdAt, and Firestore silently excludes docs missing an ordered field.
// isUserCreated is derived from createdAt presence so callers can distinguish
// real song documents from lazy status/note shadow docs for static catalog.
export function subscribeToSongs(uid, callback) {
	try {
		return onSnapshot(songsCol(uid), (snap) => {
			const songs = snap.docs.map((d) => {
				const data = d.data();
				return {
					id: d.id,
					title: data.title ?? "",
					artist: data.artist ?? "",
					tabUrl: data.tabUrl ?? "",
					youtubeUrl: data.youtubeUrl ?? null,
					instrument: data.instrument ?? null,
					status: data.status ?? "planned",
					note: data.note ?? "",
					isUserCreated: !!data.createdAt,
				};
			});
			callback(songs);
		});
	} catch (err) {
		console.warn("[firebaseSongs] error:", err);
		return () => {};
	}
}
