import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	addSong as fsAddSong,
	removeSong as fsRemoveSong,
	subscribeToSongs,
} from "./firebaseSongs";

function extractYoutubeId(url) {
	if (!url) return null;
	let m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
	return null;
}

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

	return { songs, addSong, removeSong };
}
