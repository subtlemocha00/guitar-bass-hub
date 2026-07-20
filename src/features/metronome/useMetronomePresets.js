import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthContext } from "../auth/useAuthContext";
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

// The migration flag has to be per-UID for the same reason the cache key is.
// While it was global, the first account to migrate on a device permanently
// blocked migration for every other account signing in on that device.
function migratedKey(uid) {
	return `${MIGRATED_KEY}:${uid}`;
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

// Same result shape the Firestore layer returns, so callers only ever have to
// check `result.ok` — being signed out is just another kind of failed write.
const SIGNED_OUT = {
	ok: false,
	code: "unauthenticated",
	message: "Sign in to sync presets across devices.",
};

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
	const { user } = useAuthContext();
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
					!localStorage.getItem(migratedKey(uid))
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
						legacy.forEach((preset) => {
							// id/createdAt/updatedAt are assigned by Firestore on write.
							const settings = { ...preset };
							delete settings.id;
							delete settings.createdAt;
							delete settings.updatedAt;
							Promise.resolve(addMetronomePreset(uid, settings)).then(
								(result) => {
									if (result && result.ok === false) {
										console.warn(
											"[metronomePresets] migration upload failed:",
											result.code
										);
									}
								}
							);
						});
					}

					localStorage.setItem(migratedKey(uid), "1");
				}
			}

			setPresets(fsPresets);
			writeCache(uid, fsPresets);
		});

		return unsub;
	}, [uid]);

	const savePreset = useCallback(
		(name, settings) => {
			if (!uid) return SIGNED_OUT;
			return addMetronomePreset(uid, { name, ...settings });
		},
		[uid]
	);

	const deletePreset = useCallback(
		(id) => {
			if (!uid) return SIGNED_OUT;
			return removeMetronomePreset(uid, id);
		},
		[uid]
	);

	return { presets, savePreset, deletePreset, signedIn: !!uid };
}
