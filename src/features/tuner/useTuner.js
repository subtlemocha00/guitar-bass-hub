import { useEffect, useState } from "react";
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
const MIN_FREQUENCY = 30;
const MAX_FREQUENCY = 2000;
const MIN_VOLUME_DB = -50;
const IN_TUNE_CENTS = 5;
const SMOOTHING_BUFFER_SIZE = 7;
const RESET_JUMP_CENTS = 700;

function freqToNoteInfo(frequency) {
	const exactMidi = 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
	const nearestMidi = Math.round(exactMidi);
	const cents = (exactMidi - nearestMidi) * 100;
	const name = NOTE_NAMES[((nearestMidi % 12) + 12) % 12];
	const octave = Math.floor(nearestMidi / 12) - 1;
	return { note: `${name}${octave}`, cents };
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

export function useTuner({ strings = [] } = {}) {
	const [state, setState] = useState(INITIAL_STATE);

	useEffect(() => {
		let cancelled = false;
		let rafId = null;
		let stream = null;
		let audioContext = null;
		const buffer = [];

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

					if (validReading) {
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

						const smoothed = median(buffer);
						const { note, cents } = freqToNoteInfo(smoothed);
						const targetString = findClosestString(smoothed, strings);

						setState((prev) => ({
							...prev,
							frequency: smoothed,
							note,
							cents,
							status: classify(cents),
							targetString,
						}));
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
				audioContext.close().catch(() => {});
			}
		};
	}, [strings]);

	return state;
}
