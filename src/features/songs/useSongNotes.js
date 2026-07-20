import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthContext } from "../auth/useAuthContext";
import { subscribeToSongs, updateSong } from "./firebaseSongs";

// Notes save automatically as you type. Writing on every keystroke meant one
// Firestore write per character — well past the ~1 write/sec per document
// Firestore sustains, and a large offline queue on a flaky connection. Edits
// are now batched into a single write once typing pauses.
//
// Short enough that a normal pause between words still saves promptly, long
// enough that a whole word is one write.
const DEBOUNCE_MS = 600;

export function useSongNotes(songId) {
	const { user } = useAuthContext();
	const uid = user?.uid;

	const [note, setNoteState] = useState("");

	const timerRef = useRef(null);
	// The edit awaiting (or in) a write, as { uid, songId, note }. Carrying its
	// own target means a flush is correct even if the hook has since been
	// pointed at a different song. Kept after the write so the snapshot echo can
	// be recognised.
	const pendingRef = useRef(null);
	// Set from the first keystroke until the write is sent. While it is set,
	// remote values are ignored so a snapshot can't overwrite live typing.
	const dirtyRef = useRef(false);

	const flush = useCallback(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (!dirtyRef.current) return;
		dirtyRef.current = false;

		const pending = pendingRef.current;
		if (!pending || !pending.uid || !pending.songId) return;
		updateSong(pending.uid, pending.songId, { note: pending.note });
	}, []);

	useEffect(() => {
		if (!uid) return undefined;
		return subscribeToSongs(uid, (firestoreSongs) => {
			const remote = firestoreSongs.find((s) => s.id === songId)?.note ?? "";

			// Mid-edit: the local value is newer than anything the server can send.
			if (dirtyRef.current) return;

			const pending = pendingRef.current;
			if (pending && pending.songId === songId) {
				// A write is in flight. Snapshots that don't yet reflect it are
				// stale and would revert the textarea; wait for the one that does.
				if (pending.note !== remote) return;
				pendingRef.current = null;
			}

			setNoteState(remote);
		});
	}, [uid, songId]);

	const setNote = useCallback(
		(next) => {
			setNoteState(next);
			pendingRef.current = { uid, songId, note: next };
			dirtyRef.current = true;

			if (timerRef.current !== null) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(flush, DEBOUNCE_MS);
		},
		[uid, songId, flush]
	);

	// Never lose a pending edit: write it out if the card unmounts (navigating
	// away, filtering the list) or the app is backgrounded/closed. `pagehide`
	// covers the cases `beforeunload` misses on mobile and in webviews.
	useEffect(() => {
		const onPageHide = () => flush();
		window.addEventListener("pagehide", onPageHide);
		return () => {
			window.removeEventListener("pagehide", onPageHide);
			flush();
		};
	}, [flush]);

	return { note, setNote };
}
