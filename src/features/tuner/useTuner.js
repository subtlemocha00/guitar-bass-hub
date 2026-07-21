import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";

const NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B",
];

const A4_FREQ = 440;
const A4_MIDI = 69;
const FFT_SIZE = 2048;
const MIN_CLARITY = 0.9;
const MIN_FREQUENCY = 28;
const MAX_FREQUENCY = 2000;
const MIN_VOLUME_DB = -50;
const IN_TUNE_CENTS = 5;
const SMOOTHING_BUFFER_SIZE = 7;
const RESET_JUMP_CENTS = 700;

// New constants for top-tier UX
const EMA_ALPHA = 0.2; // 20% new value, 80% old value for buttery smoothness
const MAX_GLIDE_CENTS = 150; // Snap instantly if jump is > 1.5 semitones
const SILENCE_TIMEOUT_MS = 1500; // Clear the display after 1.5s of silence

function freqToNoteInfo(frequency) {
	const exactMidi = 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
	const nearestMidi = Math.round(exactMidi);
	const cents = (exactMidi - nearestMidi) * 100;
	const name = NOTE_NAMES[((nearestMidi % 12) + 12) % 12];
	const octave = Math.floor(nearestMidi / 12) - 1;
	return { note: `${name}${octave}`, cents };
}

function centsFromTarget(freq, targetFreq) {
	return 1200 * Math.log2(freq / targetFreq);
}

function classify(cents) {
	if (cents < -IN_TUNE_CENTS) return "flat";
	if (cents > IN_TUNE_CENTS) return "sharp";
	return "in-tune";
}

function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

function findClosestString(frequency, strings) {
	if (!strings || strings.length === 0) return null;
	let closest = strings[0];
	let minDistance = Infinity;
	for (const s of strings) {
		const distance = Math.abs(1200 * Math.log2(frequency / s.freq));
		if (distance < minDistance) {
			minDistance = distance;
			closest = s;
		}
	}
	return closest;
}

const INITIAL_STATE = {
	frequency: null,
	note: null,
	cents: null,
	status: null,
	targetString: null,
	listening: false,
	error: null,
};

// ---------------------------------------------------------
// Microphone acquisition
//
// FUTURE NATIVE ABSTRACTION BOUNDARY
// acquireStream() below, plus the stream teardown in the effect cleanup, is
// what a src/platform/microphone.js would eventually own:
//     requestPermission()      explicit on mobile; implicit in getUserMedia on web
//     acquireStream()          -> MediaStream
//     stopStream(stream)
//     enumerateMicrophones()   only if a device picker is ever added
//
// Deliberately NOT extracted yet. There is exactly one caller, and the native
// shape is not knowable until a shell exists: Capacitor requires an explicit
// permission request *before* getUserMedia and needs iOS Info.plist /Android
// manifest entries, while Tauri uses the same web API behind an OS
// entitlement. Extracting now would encode a guess at an interface that has to
// serve two different permission models.
// ---------------------------------------------------------

// Browser error names -> messages we control. The UI must never render
// err.message: that is how the raw Chrome string "Requested device not found"
// reached users. Every message is phrased for the "!! MIC ACCESS // " prefix
// the tuner renders it behind.
const MIC_ERROR_MESSAGES = {
	// Permission refused, or blocked by browser/OS policy.
	NotAllowedError: "Permission denied — allow mic access for this site, then reload",
	PermissionDeniedError: "Permission denied — allow mic access for this site, then reload",
	// No audio input the browser can see. Usually nothing plugged in, or the OS
	// privacy setting is withholding every device from the browser.
	NotFoundError: "No microphone detected — connect one to retry automatically",
	DevicesNotFoundError: "No microphone detected — connect one to retry automatically",
	// Device exists but the OS or another app holds it.
	NotReadableError: "Mic is in use by another app or blocked by your system",
	TrackStartError: "Mic is in use by another app or blocked by your system",
	// Constraints could not be satisfied. Not reachable with the ideal-only
	// constraints below, but cheap to report honestly if that ever changes.
	OverconstrainedError: "No microphone matched the required settings",
	ConstraintNotSatisfiedError: "No microphone matched the required settings",
	// Insecure origin, or a policy/permissions-policy block.
	SecurityError: "Blocked by browser security — requires a secure (HTTPS) connection",
	// getUserMedia itself is missing (non-secure context, or a webview that has
	// not been granted the API). Raised by acquireStream below.
	InsecureContextError: "Requires a secure (HTTPS) connection",
	// Hardware stopped responding mid-request.
	AbortError: "Microphone stopped responding — reload to retry",
};

const DEFAULT_MIC_ERROR = "Microphone unavailable";
const DISCONNECTED_MIC_ERROR = "Microphone disconnected — reconnect to resume";

function micErrorMessage(err) {
	return MIC_ERROR_MESSAGES[err?.name] ?? DEFAULT_MIC_ERROR;
}

async function acquireStream() {
	const mediaDevices =
		typeof navigator !== "undefined" ? navigator.mediaDevices : null;

	// navigator.mediaDevices is undefined outside a secure context. Reading
	// .getUserMedia off it threw a TypeError whose raw text ("Cannot read
	// properties of undefined…") would have been shown to the user. Throw a
	// named error instead so it flows through the same mapping as the rest.
	if (!mediaDevices?.getUserMedia) {
		const err = new Error("getUserMedia is unavailable in this context");
		err.name = "InsecureContextError";
		throw err;
	}

	// Plain booleans are *ideal* constraints, not required ones, so they can
	// never cause OverconstrainedError or narrow device selection. No deviceId
	// is requested: the browser picks the system default, which is what keeps
	// this working after a mic is swapped.
	return mediaDevices.getUserMedia({
		audio: {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false,
		},
	});
}

export function useTuner({
	strings = [],
	mode = "auto",
	lockedString = null,
} = {}) {
	const [state, setState] = useState(INITIAL_STATE);
	// Bumped to re-run acquisition. Previously the effect ran once with [] deps,
	// so any failure was permanent until the component remounted.
	const [attempt, setAttempt] = useState(0);
	// Whether a stream is currently running, readable from an event handler
	// without making that handler a dependency.
	const activeRef = useRef(false);

	const stringsRef = useRef(strings);
	const modeRef = useRef(mode);
	const lockedStringRef = useRef(lockedString);

	useEffect(() => { stringsRef.current = strings; }, [strings]);
	useEffect(() => { modeRef.current = mode; }, [mode]);
	useEffect(() => { lockedStringRef.current = lockedString; }, [lockedString]);

	// Plugging a microphone in or pulling one out must not leave the tuner dead
	// for the rest of the session. Retry only while nothing is running, so a
	// healthy stream is never interrupted mid-tuning by an unrelated device
	// change (headphones, a webcam, a virtual device).
	useEffect(() => {
		const mediaDevices =
			typeof navigator !== "undefined" ? navigator.mediaDevices : null;
		if (!mediaDevices?.addEventListener) return undefined;

		const onDeviceChange = () => {
			if (!activeRef.current) setAttempt((n) => n + 1);
		};
		mediaDevices.addEventListener("devicechange", onDeviceChange);
		return () =>
			mediaDevices.removeEventListener("devicechange", onDeviceChange);
	}, []);

	useEffect(() => {
		let cancelled = false;
		let streamEnded = false;
		let rafId = null;
		let stream = null;
		let audioContext = null;

		const buffer = [];
		let displayFreq = null; // Used for EMA temporal smoothing
		let lastValidTime = performance.now(); // Used for silence detection

		async function start() {
			try {
				stream = await acquireStream();

				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}

				// A track ends when the device is unplugged or revoked. Without
				// this the analyser would keep reading silence forever and the
				// tuner would look alive but never register a note.
				stream.getAudioTracks().forEach((track) => {
					track.addEventListener("ended", () => {
						if (cancelled || streamEnded) return;
						streamEnded = true;
						activeRef.current = false;
						if (rafId !== null) {
							cancelAnimationFrame(rafId);
							rafId = null;
						}
						setState({ ...INITIAL_STATE, error: DISCONNECTED_MIC_ERROR });
					});
				});

				const Ctx = window.AudioContext || window.webkitAudioContext;
				audioContext = new Ctx();
				if (audioContext.state === "suspended") {
					await audioContext.resume();
				}

				const source = audioContext.createMediaStreamSource(stream);
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = FFT_SIZE;
				source.connect(analyser);

				const detector = PitchDetector.forFloat32Array(analyser.fftSize);
				detector.minVolumeDecibels = MIN_VOLUME_DB;
				const input = new Float32Array(detector.inputLength);

				activeRef.current = true;
				setState((prev) => ({ ...prev, listening: true, error: null }));

				const tick = () => {
					if (cancelled || streamEnded) return;
					analyser.getFloatTimeDomainData(input);
					const [pitch, clarity] = detector.findPitch(
						input,
						audioContext.sampleRate
					);

					const validReading =
						clarity >= MIN_CLARITY &&
						pitch >= MIN_FREQUENCY &&
						pitch <= MAX_FREQUENCY;

					const now = performance.now();

					if (validReading) {
						lastValidTime = now;

						// 1. Median Filter (Outlier Rejection)
						if (buffer.length > 0) {
							const currentMedian = median(buffer);
							const jumpCents = Math.abs(
								1200 * Math.log2(pitch / currentMedian)
							);
							if (jumpCents > RESET_JUMP_CENTS) {
								buffer.length = 0;
							}
						}

						buffer.push(pitch);
						if (buffer.length > SMOOTHING_BUFFER_SIZE) buffer.shift();

						const medianFreq = median(buffer);

						// 2. Exponential Moving Average (Display Smoothness)
						if (displayFreq === null) {
							displayFreq = medianFreq;
						} else {
							const glideJumpCents = Math.abs(1200 * Math.log2(medianFreq / displayFreq));
							if (glideJumpCents > MAX_GLIDE_CENTS) {
								displayFreq = medianFreq; // Snap instantly on completely new notes
							} else {
								// Glide smoothly on minor pitch changes
								displayFreq = displayFreq * (1 - EMA_ALPHA) + medianFreq * EMA_ALPHA;
							}
						}

						const noteInfo = freqToNoteInfo(displayFreq);
						const currentMode = modeRef.current;
						const currentLocked = lockedStringRef.current;
						const currentStrings = stringsRef.current;

						let targetString = null;
						let cents = 0;

						// 3. Fix: Accurate Auto-Mode Cents Resolution
						if (currentMode === "lock" && currentLocked) {
							targetString = currentLocked;
							cents = centsFromTarget(displayFreq, currentLocked.freq);
						} else if (currentStrings && currentStrings.length > 0) {
							targetString = findClosestString(displayFreq, currentStrings);
							cents = centsFromTarget(displayFreq, targetString.freq);
						} else {
							// Pure chromatic mode (if strings array is empty)
							cents = noteInfo.cents;
						}

						setState((prev) => ({
							...prev,
							frequency: displayFreq,
							note: noteInfo.note, // Actual note currently sounded
							cents,               // Cents off from target
							status: classify(cents),
							targetString,
						}));
					} else {
						// 4. Silence Fallback
						if (now - lastValidTime > SILENCE_TIMEOUT_MS) {
							buffer.length = 0;
							displayFreq = null;
							setState((prev) => {
								if (prev.frequency === null) return prev; // Avoid unneeded renders
								return { ...prev, frequency: null, note: null, cents: null, status: null, targetString: null };
							});
						}
					}

					rafId = requestAnimationFrame(tick);
				};

				rafId = requestAnimationFrame(tick);
			} catch (err) {
				if (cancelled) return;
				activeRef.current = false;
				// Log the real error for debugging; show only our own text.
				console.warn("[tuner] microphone unavailable:", err?.name, err);
				setState((prev) => ({
					...prev,
					listening: false,
					error: micErrorMessage(err),
				}));
			}
		}

		start();

		return () => {
			cancelled = true;
			activeRef.current = false;
			if (rafId !== null) cancelAnimationFrame(rafId);
			if (stream) stream.getTracks().forEach((t) => t.stop());
			if (audioContext && audioContext.state !== "closed") {
				audioContext.close().catch(() => { });
			}
		};
	}, [attempt]);

	return state;
}