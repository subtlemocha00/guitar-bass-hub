import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	addSong as fsAddSong,
	removeSong as fsRemoveSong,
	updateSong as fsUpdateSong,
	subscribeToSongs,
} from "./firebaseSongs";
import { extractYoutubeId } from "./youtubeUtils";

export function useUserSongs(instrument) {
	const { user } = useAuth();
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
			if (!uid) return null;
			return fsAddSong(uid, { ...data, instrument });
		},
		[uid, instrument]
	);

	const removeSong = useCallback(
		(songId) => {
			if (!uid) return undefined;
			return fsRemoveSong(uid, songId);
		},
		[uid]
	);

	const updateSong = useCallback(
		(songId, updates) => {
			if (!uid) return undefined;
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
