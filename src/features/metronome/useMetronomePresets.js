import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	addMetronomePreset,
	removeMetronomePreset,
	subscribeToMetronomePresets,
} from "./firebaseMetronomePresets";

// Per-UID cache key — signing in as a different account never touches another
// account's cached data.
const CACHE_KEY = "practice-hub:metronome-presets";
const MIGRATED_KEY = "practice-hub:metronome-presets-migrated";

function cacheKey(uid) {
	return `${CACHE_KEY}:${uid}`;
}

function readCache(uid) {
	try {
		const raw = localStorage.getItem(cacheKey(uid));
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeCache(uid, presets) {
	try {
		localStorage.setItem(cacheKey(uid), JSON.stringify(presets));
	} catch {
		console.warn("[metronomePresets] localStorage write failed");
	}
}

// Read the old un-keyed cache format for one-time migration.
function readLegacyCache() {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

// Flatten the localStorage format { id, name, createdAt, settings: {...} } into
// the flat shape Firestore uses.
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
	return { ...p };
}

export function useMetronomePresets() {
	const { user } = useAuth();
	const uid = user?.uid;
	const [presets, setPresets] = useState([]);
	const migratedRef = useRef(false);

	useEffect(() => {
		if (!uid) {
			setPresets([]);
			return undefined;
		}

		migratedRef.current = false;

		// Seed state from this user's cache so presets appear before Firestore responds.
		const cached = readCache(uid).map(normalizeLocalPreset).filter(Boolean);
		if (cached.length > 0) setPresets(cached);

		const unsub = subscribeToMetronomePresets(uid, (fsPresets) => {
			if (!migratedRef.current) {
				migratedRef.current = true;

				if (
					fsPresets.length === 0 &&
					!localStorage.getItem(MIGRATED_KEY)
				) {
					// One-time migration from the old un-keyed localStorage format.
					const legacy = readLegacyCache()
						.map(normalizeLocalPreset)
						.filter(Boolean);

					if (legacy.length > 0) {
						console.log(
							"[metronomePresets] migrating",
							legacy.length,
							"local presets to Firestore"
						);
						legacy.forEach(
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
			writeCache(uid, fsPresets);
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
