import { SOUND_OPTIONS } from "./soundEngine";

// Persisted metronome setup. localStorage gives instant, offline persistence so
// a practice configuration survives reloads. Everything is validated on read so
// corrupt or stale data can never crash the metronome — bad fields fall back to
// their default.
//
// ---------------------------------------------------------
// WHERE METRONOME DATA LIVES  (see also: README, "Data model")
// ---------------------------------------------------------
// localStorage, this device only (the only copy when signed out):
//   practice-hub:metronome            the live setup — every field in
//                                     DEFAULT_SETTINGS below (bpm, beats,
//                                     accent pattern, all four sounds,
//                                     subdivision, swing, tempo ramp, gap
//                                     training, random mute)
//   practice-hub:metronome-presets    named presets for signed-out users
//
// localStorage, cache only (authoritative copy is in Firestore):
//   practice-hub:metronome                          when signed in, a mirror of
//                                                   users/{uid}.prefs.metronome
//                                                   so the setup paints before
//                                                   Firestore responds
//   practice-hub:metronome-presets:{uid}            last-seen cloud presets
//   practice-hub:metronome-presets-migrated:{uid}   one-shot migration flag
//   practice-hub:metronome-migrated:{uid}           one-shot flag for seeding
//                                                   the cloud setup from this
//                                                   device (useMetronomeSettingsSync)
//
// Firestore, syncs across devices when signed in:
//   users/{uid}.prefs.metronome           the live setup (source of truth)
//   users/{uid}/metronomePresets/{id}     named presets
//
// This module stays storage-agnostic: it validates and reads/writes
// localStorage only. useMetronomeSettingsSync layers Firestore on top, using
// sanitizeSettings below to validate whatever the cloud returns.
const LS_KEY = "practice-hub:metronome";

export const DEFAULT_SETTINGS = {
	bpm: 120,
	beats: 4,
	accentPattern: [1, 0, 0, 0],
	accentSound: "hi_hat_1",
	accentSound2: "cowbell",
	beatSound: "hi_hat_1",
	subSound: "hi_hat_1",
	rampEnabled: false,
	startBpm: 60,
	endBpm: 120,
	rampDuration: 120,
	subdivision: "quarter",
	swing: "straight",
	gapEnabled: false,
	gapAudibleBars: 3,
	gapSilentBars: 1,
	randomMuteLevel: "off",
};

const isSound = (v) => typeof v === "string" && SOUND_OPTIONS.includes(v);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const str = (v, fallback) => (typeof v === "string" ? v : fallback);

function int(v, lo, hi, fallback) {
	const n = Math.round(Number(v));
	return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
}

function accents(v, beats) {
	const valid =
		Array.isArray(v) &&
		v.length === beats &&
		v.every((x) => x === 0 || x === 1 || x === 2);
	if (valid) return v.slice();
	const arr = new Array(beats).fill(0);
	arr[0] = 1;
	return arr;
}

// Coerce an arbitrary object into a known-good settings object. Exported
// because the cloud sync runs Firestore payloads through it too — a document
// written by an older app version, or by another device, gets exactly the same
// validation as anything read from localStorage.
export function sanitizeSettings(raw) {
	const d = DEFAULT_SETTINGS;
	if (!raw || typeof raw !== "object") return { ...d };
	const beats = int(raw.beats, 1, 12, d.beats);
	return {
		bpm: int(raw.bpm, 40, 300, d.bpm),
		beats,
		accentPattern: accents(raw.accentPattern, beats),
		accentSound: isSound(raw.accentSound) ? raw.accentSound : d.accentSound,
		accentSound2: isSound(raw.accentSound2) ? raw.accentSound2 : d.accentSound2,
		beatSound: isSound(raw.beatSound) ? raw.beatSound : d.beatSound,
		subSound: isSound(raw.subSound) ? raw.subSound : d.subSound,
		rampEnabled: bool(raw.rampEnabled, d.rampEnabled),
		startBpm: int(raw.startBpm, 40, 300, d.startBpm),
		endBpm: int(raw.endBpm, 40, 300, d.endBpm),
		rampDuration: int(raw.rampDuration, 1, 3600, d.rampDuration),
		subdivision: str(raw.subdivision, d.subdivision),
		swing: str(raw.swing, d.swing),
		gapEnabled: bool(raw.gapEnabled, d.gapEnabled),
		gapAudibleBars: int(raw.gapAudibleBars, 1, 8, d.gapAudibleBars),
		gapSilentBars: int(raw.gapSilentBars, 1, 8, d.gapSilentBars),
		randomMuteLevel: str(raw.randomMuteLevel, d.randomMuteLevel),
	};
}

export function loadMetronomeSettings() {
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		return sanitizeSettings(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveMetronomeSettings(settings) {
	try {
		localStorage.setItem(LS_KEY, JSON.stringify(sanitizeSettings(settings)));
	} catch {
		/* ignore storage failures (private mode, quota, etc.) */
	}
}

// ---------------------------------------------------------
// Named presets
//
// A thin, additive layer over the same localStorage approach. Presets are
// snapshots of a full settings object. The metronome applies them to its live
// state directly, so there are no changes to the scheduler or sound engine.
// ---------------------------------------------------------
const PRESETS_KEY = "practice-hub:metronome-presets";

export function listPresets() {
	try {
		const raw = localStorage.getItem(PRESETS_KEY);
		if (!raw) return [];
		const arr = JSON.parse(raw);
		if (!Array.isArray(arr)) return [];
		return arr
			.filter((p) => p && typeof p === "object" && typeof p.id === "string")
			.map((p) => ({
				id: p.id,
				name: typeof p.name === "string" ? p.name : "Preset",
				createdAt: typeof p.createdAt === "number" ? p.createdAt : 0,
				settings: sanitizeSettings(p.settings),
			}));
	} catch {
		return [];
	}
}

function writePresets(presets) {
	try {
		localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
	} catch {
		/* ignore storage failures (private mode, quota, etc.) */
	}
}

export function savePreset(name, settings) {
	const presets = listPresets();
	const preset = {
		id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		name: (typeof name === "string" && name.trim()) || `Preset ${presets.length + 1}`,
		createdAt: Date.now(),
		settings: sanitizeSettings(settings),
	};
	writePresets([...presets, preset]);
	return preset;
}

export function deletePreset(id) {
	writePresets(listPresets().filter((p) => p.id !== id));
}
