import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	addBackingTrack as fsAdd,
	removeBackingTrack as fsRemove,
	updateBackingTrack as fsUpdate,
	subscribeToBackingTracks,
} from "./firebaseBackingTracks";
import sampleBackingTracks from "./sampleBackingTracks";

function extractYoutubeId(url) {
	if (!url) return null;
	let m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
	return null;
}

function decorate(track) {
	return { ...track, youtubeId: extractYoutubeId(track.youtubeUrl) };
}

export function useUserBackingTracks(instrument) {
	const { user } = useAuth();
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
			if (!uid) return null;
			return fsAdd(uid, { ...data, instrument });
		},
		[uid, instrument]
	);

	const removeTrack = useCallback(
		(id) => {
			if (!uid) return undefined;
			return fsRemove(uid, id);
		},
		[uid]
	);

	const updateTrack = useCallback(
		(id, data) => {
			if (!uid) return undefined;
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
