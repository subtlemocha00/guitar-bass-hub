import { useCallback, useEffect, useRef, useState } from "react";

// Audio interruption detection — the shared answer to "the tuner/metronome went
// silent and the user does not know why".
//
// An OS event (an incoming phone call, an alarm, another app taking audio focus,
// an audio-route change, or the browser's own autoplay policy) suspends the
// AudioContext. WebKit reports this as state "interrupted", Chromium as
// "suspended". Either way `currentTime` stops advancing: the metronome freezes
// and the tuner reads pure silence, while both keep *looking* alive. That is the
// exact gap docs/platform-roadmap.md recorded under "Audio — interruption".
//
// This watches the one signal that unifies every source — the AudioContext's
// `statechange` event — and exposes an `interrupted` flag plus a user-gesture
// `resume()`. It is pure Web Audio, identical on web, Tauri and Capacitor, so it
// lives here as a shared hook rather than behind a platform boundary and needs no
// Capacitor plugin (nothing here has an import-time side effect). Both audio
// features drive it the same way: create the context, call watch(ctx), and on
// teardown call unwatch().

export const AUDIO_INTERRUPTION_MESSAGE =
	"Audio interrupted — tap RESUME to continue";

/**
 * Track OS/AudioContext interruptions for a context the caller owns.
 *
 * Returns:
 *   interrupted  boolean   — true while the watched context is suspended/interrupted
 *   watch(ctx)             — begin watching a context (call right after creating it;
 *                            calling again detaches the previous one)
 *   unwatch()             — stop watching (feature stopped / context closed)
 *   resume()   -> Promise<boolean> — attempt recovery; MUST be triggered from a
 *                            user gesture on iOS, which will not resume otherwise.
 */
export function useAudioInterruption() {
	const [interrupted, setInterrupted] = useState(false);
	const ctxRef = useRef(null);
	const detachRef = useRef(null);

	const watch = useCallback((ctx) => {
		// Detach any previous context first so we never leak a statechange listener
		// or report the wrong context's state.
		detachRef.current?.();
		detachRef.current = null;
		ctxRef.current = ctx || null;
		if (!ctx) return;

		const onStateChange = () => {
			const s = ctx.state;
			if (s === "running") setInterrupted(false);
			else if (s === "suspended" || s === "interrupted") setInterrupted(true);
			// "closed" is teardown — ignore, unwatch() handles it.
		};
		ctx.addEventListener("statechange", onStateChange);
		detachRef.current = () =>
			ctx.removeEventListener("statechange", onStateChange);
	}, []);

	const unwatch = useCallback(() => {
		detachRef.current?.();
		detachRef.current = null;
		ctxRef.current = null;
		setInterrupted(false);
	}, []);

	const resume = useCallback(async () => {
		const ctx = ctxRef.current;
		if (!ctx || ctx.state === "closed") return false;
		try {
			await ctx.resume();
		} catch {
			// Autoplay/interruption policy can refuse a non-gesture resume; leave the
			// flag set so the UI keeps offering RESUME. Never throw.
		}
		const ok = ctx.state === "running";
		if (ok) setInterrupted(false);
		return ok;
	}, []);

	// Safety net: detach the listener on unmount even if the feature forgot to
	// unwatch (e.g. an error path).
	useEffect(() => () => detachRef.current?.(), []);

	return { interrupted, watch, unwatch, resume };
}
