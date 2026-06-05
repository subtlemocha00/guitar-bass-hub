// ---------------------------------------------------------
// Sample-based sound engine
//
// The metronome plays only preloaded WAV samples from public/samples/. There
// is no synthesis: every voice is an AudioBuffer scheduled against
// AudioContext.currentTime via AudioBufferSourceNode.start(time).
// ---------------------------------------------------------

// Resolve a public/ asset against Vite's base path. The app is served under a
// base (e.g. "/guitar-bass-hub/"), so an absolute "/samples/..." URL would hit
// the origin root and 404. BASE_URL always ends with "/".
const withBase = (file) => `${import.meta.env.BASE_URL}${file}`;

// Single source of truth: maps a sound name to its WAV file. Every entry
// corresponds to a real file in public/samples/. SOUND_OPTIONS is derived from
// these keys, so the dropdown can never drift out of sync with the samples.
const SAMPLE_PATHS = {
	"hi_hat_1": withBase("samples/hihat1.wav"),
	"hi_hat_2": withBase("samples/hihat2.wav"),
	"open hi-hat": withBase("samples/open_hihat.wav"),
	"kick_1": withBase("samples/kick_acoustic1.wav"),
	"kick_2": withBase("samples/kick_acoustic2.wav"),
	"kick_nailgun": withBase("samples/kick_nailgun.wav"),
	"snare_1": withBase("samples/snare1.wav"),
	"snare_2": withBase("samples/snare2.wav"),
	"snare_3": withBase("samples/snare3.wav"),
	"snare_4": withBase("samples/snare4.wav"),
	"clap_1": withBase("samples/clap1.wav"),
	"clap_2": withBase("samples/clap2.wav"),
	"cowbell": withBase("samples/cowbell.wav"),
	"crash": withBase("samples/crash.wav"),
	"ride": withBase("samples/ride.wav"),
	"shaker": withBase("samples/shaker.wav"),
	"tom": withBase("samples/tom.wav"),
	"tom_808": withBase("samples/tom808.wav")
};

export const SOUND_OPTIONS = Object.keys(SAMPLE_PATHS);

// Samples peak near full-scale; this scales them to a comfortable level while
// preserving the accent/beat loudness ratio applied in playSound.
const SAMPLE_GAIN = 3.0;

// Decoded buffers keyed by URL. Module-level so it persists across calls and is
// shared by every voice. A URL is fetched and decoded at most once.
const sampleCache = new Map(); // url -> AudioBuffer
// In-flight loads keyed by URL so concurrent requests share one round trip.
const pendingLoads = new Map(); // url -> Promise<AudioBuffer | null>

// Fetch + decode one sample, caching the result. Resolves to null (never
// rejects) for a missing/undecodable file, so a warning is logged and the
// remaining samples keep loading. Cached/pending URLs short-circuit.
function loadSample(ctx, url) {
	if (sampleCache.has(url)) return Promise.resolve(sampleCache.get(url));
	if (pendingLoads.has(url)) return pendingLoads.get(url);

	const promise = (async () => {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const arrayBuffer = await res.arrayBuffer();
			const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
			sampleCache.set(url, audioBuffer);
			return audioBuffer;
		} catch (err) {
			// Missing/undecodable file: warn and leave it uncached. Playback of
			// that sound simply stays silent; nothing crashes.
			console.warn(`[soundEngine] missing sample: ${url}`, err);
			return null;
		} finally {
			pendingLoads.delete(url);
		}
	})();

	pendingLoads.set(url, promise);
	return promise;
}

let preloadStarted = false;

// Fetch + decode every sample once, when the AudioContext is created.
// Idempotent and fire-and-forget: returns immediately and must never run inside
// the scheduler loop. All decoding happens here so playback never fetches or
// decodes.
export function preloadSamples(ctx) {
	if (!ctx || preloadStarted) return;
	preloadStarted = true;
	const urls = [...new Set(Object.values(SAMPLE_PATHS))];
	for (const url of urls) {
		loadSample(ctx, url);
	}
}

// Schedule a decoded sample for sample-accurate playback. Uses
// AudioBufferSourceNode.start(time) against ctx.currentTime — no setTimeout, no
// real-time triggering.
function playSample(ctx, time, buffer, gain) {
	const src = ctx.createBufferSource();
	src.buffer = buffer;

	const gainNode = ctx.createGain();
	gainNode.gain.value = gain;

	src.connect(gainNode).connect(ctx.destination);
	src.start(time);
}

// Schedule a sound by name at an exact AudioContext time. The buffer lookup is
// a synchronous Map.get on an already-decoded sample — no fetch, no decode — so
// this is safe to call from inside the scheduler. If the sample isn't loaded
// (still decoding, or missing), the beat stays silent.
export function playSound(type, ctx, time, accent = false, gainScale = 1) {
	if (!ctx) return;
	const url = SAMPLE_PATHS[type];
	if (!url) return;
	const buffer = sampleCache.get(url);
	if (!buffer) return;

	const gain = (accent ? 0.22 : 0.12) * gainScale * SAMPLE_GAIN;
	playSample(ctx, time, buffer, gain);
}
