import { useCallback, useEffect, useRef } from "react";
import { useAuthContext } from "../auth/useAuthContext";
import { subscribeToPrefs, setPref } from "../../firebase/userPrefs";
import { readItem, writeItem } from "../../platform/storage";
import { sanitizeSettings, saveMetronomeSettings } from "./metronomeStorage";

// Cross-device sync for the live metronome setup, modelled on useSortPreference:
// localStorage is written immediately on every change (instant, works offline
// and signed out), and Firestore is the source of truth whenever the user is
// signed in. Dial in 96 BPM with swing on one device, open another, get the
// same setup back.
//
// The setup lives at users/{uid}.prefs.metronome — the same `prefs` map the
// song sort order and setlist order already use, so this adds no new Firestore
// path and no new security surface.
const PREF_KEY = "metronome";

// Long enough that dragging the BPM slider is one write instead of eighty,
// short enough that switching devices mid-practice feels immediate. Pending
// writes are also flushed on unmount and on pagehide, so nothing is lost.
const DEBOUNCE_MS = 800;

const MIGRATED_KEY = "practice-hub:metronome-migrated";

function migratedKey(uid) {
	return `${MIGRATED_KEY}:${uid}`;
}

function hasMigrated(uid) {
	try {
		return !!readItem(migratedKey(uid));
	} catch {
		return false;
	}
}

function markMigrated(uid) {
	try {
		writeItem(migratedKey(uid), "1");
	} catch {
		/* ignore storage failures (private mode, quota, etc.) */
	}
}

/**
 * Persist the live metronome setup and keep it in sync across devices.
 *
 * @param settings         the current setup (a stable object — memoize it)
 * @param onRemoteSettings called with a validated settings object when another
 *                         device changes the setup; wire it to applySettings
 */
export function useMetronomeSettingsSync(settings, onRemoteSettings) {
	const { user } = useAuthContext();
	const uid = user?.uid;

	// Serialized payload we believe is currently on the server. Used to tell our
	// own echo apart from a genuine change made elsewhere, which is what stops
	// write -> snapshot -> apply -> write from looping forever.
	const serverJsonRef = useRef(null);
	// The uid whose first snapshot has been handled. Nothing uploads until this
	// matches the signed-in uid, so a device cannot clobber the stored setup
	// with its own defaults before it has seen them. Keyed by uid rather than a
	// boolean because switching accounts re-runs the upload effect before the
	// subscribe effect: a stale `true` there would push the previous account's
	// setup into the new account's document.
	const hydratedUidRef = useRef(null);
	const timerRef = useRef(null);
	const pendingRef = useRef(null);

	// Latest values, read from callbacks that must not re-subscribe when they
	// change (same pattern as configRef in Metronome.jsx).
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	const applyRef = useRef(onRemoteSettings);
	applyRef.current = onRemoteSettings;

	const flush = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		const pending = pendingRef.current;
		if (!pending) return;
		pendingRef.current = null;
		serverJsonRef.current = pending.json;
		setPref(pending.uid, PREF_KEY, pending.settings);
	}, []);

	// Save locally on every change; queue a debounced cloud write when signed in.
	useEffect(() => {
		saveMetronomeSettings(settings);

		if (!uid || hydratedUidRef.current !== uid) return undefined;

		const clean = sanitizeSettings(settings);
		const json = JSON.stringify(clean);
		// Already the stored value — nothing to send.
		if (json === serverJsonRef.current) return undefined;

		pendingRef.current = { uid, json, settings: clean };
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(flush, DEBOUNCE_MS);
		return undefined;
	}, [settings, uid, flush]);

	// Adopt the stored setup, and follow changes made on other devices.
	useEffect(() => {
		hydratedUidRef.current = null;
		serverJsonRef.current = null;
		pendingRef.current = null;
		if (!uid) return undefined;

		const adopt = (clean, json) => {
			serverJsonRef.current = json;
			saveMetronomeSettings(clean);
			applyRef.current(clean);
		};

		const unsub = subscribeToPrefs(uid, (prefs) => {
			const remote = prefs?.[PREF_KEY];
			const hasRemote = !!remote && typeof remote === "object";

			// First response for this account.
			if (hydratedUidRef.current !== uid) {
				hydratedUidRef.current = uid;

				if (hasRemote) {
					const clean = sanitizeSettings(remote);
					adopt(clean, JSON.stringify(clean));
					return;
				}

				// Nothing stored yet: seed the account from this device's setup so
				// signing in does not silently reset a dialled-in metronome. Guarded
				// by a uid-scoped flag so it happens exactly once per account —
				// after that, an empty document means the user cleared it and gets
				// left alone.
				if (!hasMigrated(uid)) {
					const clean = sanitizeSettings(settingsRef.current);
					serverJsonRef.current = JSON.stringify(clean);
					setPref(uid, PREF_KEY, clean);
					markMigrated(uid);
				}
				return;
			}

			if (!hasRemote) return;

			const clean = sanitizeSettings(remote);
			const json = JSON.stringify(clean);
			// Our own write coming back, or a snapshot with no relevant change.
			if (json === serverJsonRef.current) return;
			// A local edit is still queued: it is newer, so let it win rather than
			// yanking controls out from under someone who is mid-adjustment.
			if (pendingRef.current) return;

			adopt(clean, json);
		});

		return () => {
			flush();
			unsub();
		};
	}, [uid, flush]);

	// Backgrounding or closing the app should not drop a queued change.
	// pagehide rather than beforeunload: beforeunload is unreliable on mobile
	// and inside webviews.
	useEffect(() => {
		window.addEventListener("pagehide", flush);
		return () => window.removeEventListener("pagehide", flush);
	}, [flush]);
}
