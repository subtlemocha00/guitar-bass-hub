import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
	addMetronomePreset,
	removeMetronomePreset,
	subscribeToMetronomePresets,
} from "./firebaseMetronomePresets";

const CACHE_KEY = "practice-hub:metronome-presets";
const MIGRATED_KEY = "practice-hub:metronome-presets-migrated";

// Sound name map for presets saved under the old naming convention.
const LEGACY_SOUND_MAP = {
	hi_hat_1: "hi-hat",
	hi_hat_2: "hi-hat",
	hi_hat_3: "hi-hat",
};

function normalizeSound(name) {
	if (typeof name !== "string") return undefined;
	return LEGACY_SOUND_MAP[name] ?? name;
}

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

// Flatten the old { id, name, createdAt, settings: {...} } shape into the
// flat shape used by Firestore, and normalize any legacy sound names.
function normalizeLocalPreset(p) {
	if (!p || typeof p !== "object") return null;
	const base =
		p.settings && typeof p.settings === "object"
			? { id: p.id, name: p.name, createdAt: p.createdAt, ...p.settings }
			: { ...p };

	if (base.accentSound) base.accentSound = normalizeSound(base.accentSound) ?? base.accentSound;
	if (base.beatSound) base.beatSound = normalizeSound(base.beatSound) ?? base.beatSound;
	if (base.subSound) base.subSound = normalizeSound(base.subSound) ?? base.subSound;

	return base;
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

		// Reset migration guard when uid changes (new sign-in).
		migratedRef.current = false;

		const unsub = subscribeToMetronomePresets(uid, (fsPresets) => {
			// Migration runs at most once per sign-in session.
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

					// Mark migration done so it never re-runs on this device.
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
