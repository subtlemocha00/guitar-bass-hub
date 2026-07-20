import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "../auth/useAuthContext";
import {
	addSong as fsAddSong,
	removeSong as fsRemoveSong,
	updateSong as fsUpdateSong,
	subscribeToSongs,
} from "./firebaseSongs";
import { extractYoutubeId } from "./youtubeUtils";

// Same result shape the Firestore layer returns, so callers only ever have to
// check `result.ok` — being signed out is just another kind of failed write.
const SIGNED_OUT = {
	ok: false,
	code: "unauthenticated",
	message: "Sign in to save your songs.",
};

export function useUserSongs(instrument) {
	const { user } = useAuthContext();
	const uid = user?.uid;
	const [songs, setSongs] = useState([]);

	useEffect(() => {
		if (!uid) {
			setSongs([]);
			return undefined;
		}
		return subscribeToSongs(uid, (allSongs) => {
			const filtered = allSongs
				.filter((s) => s.isUserCreated && s.instrument === instrument)
				.map((s) => ({
					...s,
					youtubeId: extractYoutubeId(s.youtubeUrl),
				}));
			setSongs(filtered);
		});
	}, [uid, instrument]);

	const addSong = useCallback(
		(data) => {
			if (!uid) return SIGNED_OUT;
			return fsAddSong(uid, { ...data, instrument });
		},
		[uid, instrument]
	);

	const removeSong = useCallback(
		(songId) => {
			if (!uid) return SIGNED_OUT;
			return fsRemoveSong(uid, songId);
		},
		[uid]
	);

	const updateSong = useCallback(
		(songId, updates) => {
			if (!uid) return SIGNED_OUT;
			return fsUpdateSong(uid, songId, {
				title: updates.title,
				artist: updates.artist,
				tabUrl: updates.tabUrl,
				youtubeUrl: updates.youtubeUrl ?? null,
			});
		},
		[uid]
	);

	return { songs, addSong, removeSong, updateSong };
}
