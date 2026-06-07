import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	addMetronomePreset,
	removeMetronomePreset,
	subscribeToMetronomePresets,
} from "./firebaseMetronomePresets";

const CACHE_KEY = "practice-hub:metronome-presets";
const MIGRATED_KEY = "practice-hub:metronome-presets-migrated";

function readCache() {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeCache(presets) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(presets));
	} catch {
		console.warn("[metronomePresets] localStorage write failed");
	}
}

// Flatten the localStorage format { id, name, createdAt, settings: {...} } into
// the flat shape Firestore uses. The .settings object may already contain a
// numeric accentPattern (0/1/2) from metronomeStorage — leave those values as-is.
function normalizeLocalPreset(p) {
	if (!p || typeof p !== "object") return null;
	if (p.settings && typeof p.settings === "object") {
		return {
			id: p.id ?? String(Date.now()),
			name: p.name ?? "Untitled",
			createdAt: p.createdAt ?? Date.now(),
			updatedAt: p.createdAt ?? Date.now(),
			...p.settings,
		};
	}
	// Already flat — pass through.
	return { ...p };
}

export function useMetronomePresets() {
	const { user } = useAuth();
	const uid = user?.uid;
	const [presets, setPresets] = useState(() =>
		readCache().map(normalizeLocalPreset).filter(Boolean)
	);
	const migratedRef = useRef(false);

	useEffect(() => {
		if (!uid) {
			setPresets([]);
			return undefined;
		}

		migratedRef.current = false;

		const unsub = subscribeToMetronomePresets(uid, (fsPresets) => {
			if (!migratedRef.current) {
				migratedRef.current = true;

				if (
					fsPresets.length === 0 &&
					!localStorage.getItem(MIGRATED_KEY)
				) {
					const local = readCache()
						.map(normalizeLocalPreset)
						.filter(Boolean);

					if (local.length > 0) {
						console.log(
							"[metronomePresets] migrating",
							local.length,
							"local presets to Firestore"
						);
						local.forEach(
							({ id: _id, createdAt: _ca, updatedAt: _ua, ...settings }) => {
								addMetronomePreset(uid, settings).catch((err) => {
									console.warn(
										"[metronomePresets] migration upload error:",
										err
									);
								});
							}
						);
					}

					localStorage.setItem(MIGRATED_KEY, "1");
				}
			}

			setPresets(fsPresets);
			writeCache(fsPresets);
		});

		return unsub;
	}, [uid]);

	const savePreset = useCallback(
		(name, settings) => {
			if (!uid) {
				console.warn("[metronomePresets] cannot save: not signed in");
				return null;
			}
			return addMetronomePreset(uid, { name, ...settings });
		},
		[uid]
	);

	const deletePreset = useCallback(
		(id) => {
			if (!uid) return undefined;
			return removeMetronomePreset(uid, id);
		},
		[uid]
	);

	return { presets, savePreset, deletePreset, signedIn: !!uid };
}
