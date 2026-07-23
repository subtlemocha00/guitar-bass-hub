// Capacitor microphone acquisition.
//
// WHY THIS IMPORTS NO CAPACITOR PLUGIN (and so needs no build alias)
// A tuner needs a *live* MediaStream for real-time pitch detection. No Capacitor
// plugin provides one:
//   - @capacitor/microphone does not exist (there is no first-party mic plugin);
//   - @capacitor/camera covers camera + photo-library permissions, not the mic;
//   - the community recorders (e.g. @mozartec/capacitor-microphone) capture audio
//     to a *file* — and their ESM does call registerPlugin() at import, so using
//     one would force a build alias — but a recorder is the wrong tool: it cannot
//     hand back the live stream the analyser reads.
// So on every target the live stream comes from the WebView's own
// navigator.mediaDevices.getUserMedia (reused from webMicrophone below — the call
// is identical). The native OS microphone permission is delivered by Capacitor's
// WebView bridge from *static native config*, not a JS import:
//   Android — RECORD_AUDIO in AndroidManifest.xml; Capacitor's onPermissionRequest
//             turns the WebView's getUserMedia into a runtime permission prompt.
//   iOS     — NSMicrophoneUsageDescription in Info.plist; WKWebView prompts natively.
// Because nothing here calls registerPlugin() at import time, there is no side
// effect for an alias to isolate — this boundary is selected by a compile-time
// boolean, unlike auth/storage/lifecycle/links. See docs/architecture.md.

// acquireStream / stopStream are the identical WebView getUserMedia call on every
// target, so reuse them rather than duplicate. Only permission handling differs.
export { acquireStream, stopStream } from "./webMicrophone";

/**
 * Current mic permission on Capacitor, best-effort and non-throwing.
 *
 * The Android System WebView (Chromium) supports the W3C Permissions API, so a
 * hard "denied" can be read up front and surfaced through useTuner's existing
 * NotAllowedError mapping instead of a silent getUserMedia failure. iOS WKWebView
 * exposes no Permissions API for the microphone, so it falls through to "prompt"
 * and the OS prompt fires during acquireStream() via the WebView bridge. Either
 * way the actual grant still happens in getUserMedia — there is no plugin to
 * request ahead of it — so this only *observes* state, never blocks acquisition.
 */
export async function requestPermission() {
	try {
		const perms =
			typeof navigator !== "undefined" ? navigator.permissions : null;
		if (perms?.query) {
			const status = await perms.query({ name: "microphone" });
			return status.state; // "granted" | "denied" | "prompt"
		}
	} catch {
		// "microphone" is not a recognised PermissionName here (WKWebView, or an
		// engine that rejects the query) — fall through and let acquireStream prompt.
	}
	return "prompt";
}
