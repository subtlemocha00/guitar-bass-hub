import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	getCachedNote,
	getNote,
	setNote as persistNote,
} from "./songStorage";

export function useSongNotes(songId) {
	const { user } = useAuth();
	const uid = user?.uid;

	const [note, setNoteState] = useState(() => getCachedNote(songId));

	useEffect(() => {
		if (!uid) return undefined;
		let cancelled = false;
		getNote(uid, songId).then((value) => {
			if (cancelled) return;
			setNoteState(value);
		});
		return () => {
			cancelled = true;
		};
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
