import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthContext } from "../auth/useAuthContext";
import {
	addBackingTrack as fsAdd,
	removeBackingTrack as fsRemove,
	updateBackingTrack as fsUpdate,
	subscribeToBackingTracks,
} from "./firebaseBackingTracks";
import sampleBackingTracks from "./sampleBackingTracks";
import { extractYoutubeId } from "../songs/youtubeUtils";

function decorate(track) {
	return { ...track, youtubeId: extractYoutubeId(track.youtubeUrl) };
}

// Same result shape the Firestore layer returns, so callers only ever have to
// check `result.ok` — being signed out is just another kind of failed write.
const SIGNED_OUT = {
	ok: false,
	code: "unauthenticated",
	message: "Sign in to save your backing tracks.",
};

export function useUserBackingTracks(instrument) {
	const { user } = useAuthContext();
	const uid = user?.uid;
	const [userTracks, setUserTracks] = useState([]);

	useEffect(() => {
		if (!uid) {
			setUserTracks([]);
			return undefined;
		}
		return subscribeToBackingTracks(uid, (all) => {
			setUserTracks(
				all.filter((t) => t.isUserCreated && t.instrument === instrument)
			);
		});
	}, [uid, instrument]);

	const samples = useMemo(
		() =>
			sampleBackingTracks
				.filter((t) => t.instrument === instrument)
				.map((t) => ({ ...t, isUserCreated: false })),
		[instrument]
	);

	// When signed-in: show only the user's tracks (samples disappear once they
	// have their own data). When signed-out: show samples read-only as preview.
	const tracks = useMemo(() => {
		const list = uid ? userTracks : samples;
		return list.map(decorate);
	}, [uid, userTracks, samples]);

	const addTrack = useCallback(
		(data) => {
			if (!uid) return SIGNED_OUT;
			return fsAdd(uid, { ...data, instrument });
		},
		[uid, instrument]
	);

	const removeTrack = useCallback(
		(id) => {
			if (!uid) return SIGNED_OUT;
			return fsRemove(uid, id);
		},
		[uid]
	);

	const updateTrack = useCallback(
		(id, data) => {
			if (!uid) return SIGNED_OUT;
			return fsUpdate(uid, id, {
				title: data.title,
				artist: data.artist,
				youtubeUrl: data.youtubeUrl,
				genre: data.genre || "",
				bpm: typeof data.bpm === "number" ? data.bpm : null,
				trackKey: data.trackKey || "",
				notes: data.notes || "",
			});
		},
		[uid]
	);

	return { tracks, addTrack, removeTrack, updateTrack, signedIn: !!uid };
}
