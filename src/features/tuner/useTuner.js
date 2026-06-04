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

export function useTuner({
	strings = [],
	mode = "auto",
	lockedString = null,
} = {}) {
	const [state, setState] = useState(INITIAL_STATE);

	const stringsRef = useRef(strings);
	const modeRef = useRef(mode);
	const lockedStringRef = useRef(lockedString);

	useEffect(() => { stringsRef.current = strings; }, [strings]);
	useEffect(() => { modeRef.current = mode; }, [mode]);
	useEffect(() => { lockedStringRef.current = lockedString; }, [lockedString]);

	useEffect(() => {
		let cancelled = false;
		let rafId = null;
		let stream = null;
		let audioContext = null;

		const buffer = [];
		let displayFreq = null; // Used for EMA temporal smoothing
		let lastValidTime = performance.now(); // Used for silence detection

		async function start() {
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: false,
						noiseSuppression: false,
						autoGainControl: false,
					},
				});

				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}

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

				setState((prev) => ({ ...prev, listening: true, error: null }));

				const tick = () => {
					if (cancelled) return;
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
				setState((prev) => ({
					...prev,
					listening: false,
					error: err?.message || "Microphone unavailable",
				}));
			}
		}

		start();

		return () => {
			cancelled = true;
			if (rafId !== null) cancelAnimationFrame(rafId);
			if (stream) stream.getTracks().forEach((t) => t.stop());
			if (audioContext && audioContext.state !== "closed") {
				audioContext.close().catch(() => { });
			}
		};
	}, []);

	return state;
}