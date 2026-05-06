import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { subscribeToSongs, updateSong } from "./firebaseSongs";

export function useSongNotes(songId) {
	const { user } = useAuth();
	const uid = user?.uid;

	const [note, setNoteState] = useState("");

	useEffect(() => {
		if (!uid) return;
		const unsubscribe = subscribeToSongs(uid, (firestoreSongs) => {
			const match = firestoreSongs.find((s) => s.id === songId);
			setNoteState(match?.note ?? "");
		});
		return unsubscribe;
	}, [uid, songId]);

	const setNote = useCallback(
		(next) => {
			setNoteState(next);
			updateSong(uid, songId, { note: next });
		},
		[uid, songId]
	);

	return { note, setNote };
}
