import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	getCachedNote,
	setNote as persistNote,
	subscribeToUserData,
} from "./songStorage";

export function useSongNotes(songId) {
	const { user } = useAuth();
	const uid = user?.uid;

	const [note, setNoteState] = useState(() => getCachedNote(songId));

	useEffect(() => {
		if (!uid) return undefined;
		const unsubscribe = subscribeToUserData(uid, ({ notes }) => {
			if (!(songId in notes)) return;
			const value = notes[songId];
			setNoteState(typeof value === "string" ? value : "");
		});
		return unsubscribe;
	}, [uid, songId]);

	const setNote = useCallback(
		(next) => {
			setNoteState(next);
			persistNote(uid, songId, next);
		},
		[uid, songId]
	);

	return { note, setNote };
}
