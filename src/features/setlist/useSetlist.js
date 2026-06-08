import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { subscribeToSongs } from "../songs/firebaseSongs";
import { subscribeToSetlistOrder, saveSetlistOrder } from "./firebaseSetlist";

function applyOrder(completedSongs, savedOrder) {
	if (!savedOrder) return completedSongs;

	const byId = Object.fromEntries(completedSongs.map((s) => [s.id, s]));
	const ordered = savedOrder.filter((id) => byId[id]).map((id) => byId[id]);
	const inOrder = new Set(savedOrder);
	const appended = completedSongs.filter((s) => !inOrder.has(s.id));
	return [...ordered, ...appended];
}

export function useSetlist() {
	const { user } = useAuth();
	const uid = user?.uid;

	const [completedSongs, setCompletedSongs] = useState([]);
	const [savedOrder, setSavedOrder] = useState(null);
	const [loading, setLoading] = useState(true);

	const songsReadyRef = useRef(false);
	const orderReadyRef = useRef(false);

	useEffect(() => {
		if (!uid) {
			setCompletedSongs([]);
			setSavedOrder(null);
			setLoading(false);
			songsReadyRef.current = false;
			orderReadyRef.current = false;
			return undefined;
		}

		setLoading(true);
		songsReadyRef.current = false;
		orderReadyRef.current = false;

		const unsubSongs = subscribeToSongs(uid, (allSongs) => {
			const completed = allSongs.filter(
				(s) => s.isUserCreated && s.status === "completed"
			);
			setCompletedSongs(completed);
			songsReadyRef.current = true;
			if (orderReadyRef.current) setLoading(false);
		});

		const unsubOrder = subscribeToSetlistOrder(uid, (order) => {
			setSavedOrder(order);
			orderReadyRef.current = true;
			if (songsReadyRef.current) setLoading(false);
		});

		return () => {
			unsubSongs();
			unsubOrder();
		};
	}, [uid]);

	const orderedList = applyOrder(completedSongs, savedOrder);

	const reorder = useCallback(
		(newList) => {
			if (!uid) return;
			const ids = newList.map((s) => s.id);
			setSavedOrder(ids);
			saveSetlistOrder(uid, ids);
		},
		[uid]
	);

	return { orderedList, reorder, loading, signedIn: !!uid };
}
