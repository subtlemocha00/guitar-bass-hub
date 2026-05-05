import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	getCachedStatus,
	setStatus as persistStatus,
	STATUSES,
	subscribeToUserData,
} from "./songStorage";

export function useSongStatus(songs = []) {
	const { user } = useAuth();
	const uid = user?.uid;

	const [statuses, setStatuses] = useState(() => {
		const map = {};
		for (const song of songs) {
			map[song.id] = getCachedStatus(song.id);
		}
		return map;
	});

	useEffect(() => {
		if (!uid) return undefined;
		const unsubscribe = subscribeToUserData(uid, ({ statuses: remote }) => {
			setStatuses((prev) => {
				const next = { ...prev };
				for (const id of Object.keys(remote)) {
					const value = remote[id];
					if (STATUSES.includes(value)) {
						next[id] = value;
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
			persistStatus(uid, songId, next);
		},
		[uid]
	);

	return { statuses, updateStatus };
}
