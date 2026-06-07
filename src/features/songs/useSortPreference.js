import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { DEFAULT_SORT, SORT_OPTIONS } from "./sortOptions";
import { subscribeToPrefs, setPref } from "./firebaseUserPrefs";

const VALID = SORT_OPTIONS.map((o) => o.value);
const lsKey = (instrument) => `practice-hub:sort:${instrument}`;
const prefKey = (instrument) => `sort:${instrument}`;

function readLocal(instrument) {
	try {
		const value = localStorage.getItem(lsKey(instrument));
		return VALID.includes(value) ? value : DEFAULT_SORT;
	} catch {
		return DEFAULT_SORT;
	}
}

function writeLocal(instrument, value) {
	try {
		localStorage.setItem(lsKey(instrument), value);
	} catch {
		/* ignore storage failures (private mode, quota, etc.) */
	}
}

/**
 * Persistent sort preference for a song list.
 * - localStorage gives instant, offline persistence on this device.
 * - When signed in, the value also syncs to Firestore so it follows the
 *   user to any other device.
 */
export function useSortPreference(instrument) {
	const { user } = useAuth();
	const uid = user?.uid;
	const [sort, setSortState] = useState(() => readLocal(instrument));

	// Re-read the local value if the instrument changes.
	useEffect(() => {
		setSortState(readLocal(instrument));
	}, [instrument]);

	// Cross-device sync: adopt the stored preference from Firestore.
	useEffect(() => {
		if (!uid) return undefined;
		return subscribeToPrefs(uid, (prefs) => {
			const remote = prefs?.[prefKey(instrument)];
			if (VALID.includes(remote)) {
				setSortState(remote);
				writeLocal(instrument, remote);
			}
		});
	}, [uid, instrument]);

	const setSort = useCallback(
		(next) => {
			if (!VALID.includes(next)) return;
			setSortState(next);
			writeLocal(instrument, next);
			if (uid) setPref(uid, prefKey(instrument), next);
		},
		[uid, instrument]
	);

	return [sort, setSort];
}
