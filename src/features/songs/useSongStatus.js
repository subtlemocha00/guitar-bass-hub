import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "../auth/useAuthContext";
import { STATUSES } from "./songStorage";
import { subscribeToSongs, updateSong } from "./firebaseSongs";

export function useSongStatus(songs = []) {
	const { user } = useAuthContext();
	const uid = user?.uid;

	const [statuses, setStatuses] = useState(() => {
		const map = {};
		for (const song of songs) {
			map[song.id] = "planned";
		}
		return map;
	});

	useEffect(() => {
		if (!uid) return;
		const unsubscribe = subscribeToSongs(uid, (firestoreSongs) => {
			setStatuses((prev) => {
				const next = { ...prev };
				for (const fs of firestoreSongs) {
					if (STATUSES.includes(fs.status)) {
						next[fs.id] = fs.status;
					}
				}
				return next;
			});
		});
		return unsubscribe;
	}, [uid]);

	const updateStatus = useCallback(
		(songId, next) => {
			setStatuses((prev) => ({ ...prev, [songId]: next }));
			updateSong(uid, songId, { status: next });
		},
		[uid]
	);

	return { statuses, updateStatus };
}
