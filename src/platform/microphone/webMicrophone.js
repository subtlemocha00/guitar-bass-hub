// Web + Tauri microphone acquisition.
//
// The browser and the Tauri WebView both hand back a live MediaStream from
// getUserMedia, and the permission prompt is folded into that call — there is no
// separate request step. This is the exact getUserMedia logic that used to live
// inline in useTuner.js, moved here verbatim so behaviour is byte-for-byte
// identical: same ideal-only constraints, same InsecureContextError contract.

/**
 * Current mic permission, best-effort. Web/Tauri fold the real prompt into
 * acquireStream()'s getUserMedia, so there is nothing to request ahead of time.
 * Report "prompt" (unknown — the acquire call will prompt if needed) and never
 * throw, so useTuner can await it unconditionally without changing behaviour.
 */
export async function requestPermission() {
	return "prompt";
}

/**
 * Acquire a live microphone MediaStream.
 *
 * Throws *named* errors that useTuner maps to its own copy — notably
 * InsecureContextError when getUserMedia is absent (a non-secure context), so the
 * raw "Cannot read properties of undefined" TypeError never reaches the user.
 */
export async function acquireStream() {
	const mediaDevices =
		typeof navigator !== "undefined" ? navigator.mediaDevices : null;

	// navigator.mediaDevices is undefined outside a secure context. Reading
	// .getUserMedia off it would throw a TypeError whose raw text would be shown
	// to the user. Throw a named error instead so it flows through the same
	// mapping as every other mic failure.
	if (!mediaDevices?.getUserMedia) {
		const err = new Error("getUserMedia is unavailable in this context");
		err.name = "InsecureContextError";
		throw err;
	}

	// Plain booleans are *ideal* constraints, not required ones, so they can never
	// cause OverconstrainedError or narrow device selection. No deviceId is
	// requested: the browser picks the system default, which is what keeps this
	// working after a mic is swapped.
	return mediaDevices.getUserMedia({
		audio: {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false,
		},
	});
}

/** Stop every track so the OS releases the microphone. Safe to call with null. */
export function stopStream(stream) {
	if (stream) stream.getTracks().forEach((t) => t.stop());
}
