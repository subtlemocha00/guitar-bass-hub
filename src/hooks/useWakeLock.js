import { useEffect, useRef } from "react";

// Screen Wake Lock — keep the display awake while the tuner is listening or the
// metronome is running, so a hands-off practice session is not cut short by the
// screen sleeping. On mobile a sleeping screen also suspends the AudioContext and
// kills the sound, so this directly protects the audio too.
//
// WHY NO PLUGIN AND NO PLATFORM BRANCH
// navigator.wakeLock is a standard web API present in every target's WebView that
// supports it — Android WebView (Chromium), WebView2 (Tauri desktop) and iOS
// WKWebView 16.4+. It has no import-time side effect, so it needs neither a
// Capacitor plugin nor the @…-impl alias: a capability feature-detect is the whole
// compatibility story. Where the API is absent (older iOS, reduced environments)
// the hook is a no-op and reports supported=false so the UI can warn that the
// screen may sleep. This was verified against the Capacitor 8 WebViews, not
// assumed — a native keep-awake plugin would be speculative.
//
// The platform releases a screen lock whenever the page is hidden (tab switch,
// screen lock), so the lock is re-acquired on visibilitychange while still active.

const WAKE_LOCK_SUPPORTED =
	typeof navigator !== "undefined" && "wakeLock" in navigator;

/**
 * Hold a screen wake lock while `active` is true; release it the instant `active`
 * goes false or the component unmounts. Returns { supported } so a caller can tell
 * the user the screen may sleep where the platform cannot hold a lock. Never throws.
 */
export function useWakeLock(active) {
	const sentinelRef = useRef(null);

	useEffect(() => {
		if (!WAKE_LOCK_SUPPORTED || !active) return undefined;

		let released = false;

		const acquire = async () => {
			// The platform only grants a lock while the page is visible; the
			// visibility handler re-acquires when the user returns.
			if (typeof document === "undefined" || document.visibilityState !== "visible")
				return;
			try {
				const sentinel = await navigator.wakeLock.request("screen");
				if (released) {
					sentinel.release().catch(() => {});
					return;
				}
				sentinelRef.current = sentinel;
				// The platform can drop the lock on its own (e.g. low battery); clear
				// our handle so the visibility handler can re-acquire it.
				sentinel.addEventListener("release", () => {
					sentinelRef.current = null;
				});
			} catch {
				// NotAllowedError and friends — degrade silently. A transient wake-lock
				// failure must never interrupt tuning or the metronome.
			}
		};

		const onVisibility = () => {
			if (document.visibilityState === "visible" && !sentinelRef.current) {
				acquire();
			}
		};

		acquire();
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			released = true;
			document.removeEventListener("visibilitychange", onVisibility);
			const sentinel = sentinelRef.current;
			sentinelRef.current = null;
			if (sentinel) sentinel.release().catch(() => {});
		};
	}, [active]);

	return { supported: WAKE_LOCK_SUPPORTED };
}
