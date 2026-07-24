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
// target, so reuse them rather than duplicate. Permission handling is now also
// identical to the web path (see requestPermission below) — getUserMedia is the
// single authoritative request on every target.
export { acquireStream, stopStream } from "./webMicrophone";

/**
 * Current mic permission on Capacitor. Always "prompt" — deliberately.
 *
 * WHY WE DO NOT USE navigator.permissions.query({ name: "microphone" }) HERE
 * The obvious idea — read the permission up front on Android's Chromium WebView
 * and surface a hard "denied" through useTuner's NotAllowedError mapping — is
 * wrong, and a real device proved it: with RECORD_AUDIO in the manifest and the
 * OS microphone permission *granted*, the query still resolves to "denied", so
 * useTuner threw before acquireStream() and getUserMedia() never ran. The same
 * device's PWA worked, because the PWA never runs this pre-check.
 *
 * The Permissions API is present in Android System WebView but does NOT reflect
 * capture-device state: WebView has no persistent per-origin grant store for the
 * microphone. Capture permission is decided per request by Capacitor's native
 * bridge (WebChromeClient.onPermissionRequest, backed by the OS RECORD_AUDIO
 * grant) at the moment getUserMedia() runs. With no stored grant to report, the
 * query returns "denied" by default (or, on some WebView versions, rejects the
 * unrecognised name). Neither is a trustworthy signal, so we consult neither.
 *
 * Instead getUserMedia() is the authoritative permission request on every target,
 * exactly as it already is on web/Tauri: on Android it drives onPermissionRequest
 * and the OS prompt; on iOS WKWebView prompts natively; on web/Tauri the browser
 * folds the prompt in. A genuine refusal comes back as getUserMedia()'s own
 * NotAllowedError, which useTuner already maps — so reporting "prompt" here loses
 * no legitimate error, it only stops fabricating a false denial. This makes the
 * Capacitor path byte-for-byte identical to webMicrophone; it is kept as its own
 * function purely to document the Android-WebView reasoning at the site it
 * applies. See docs/architecture.md and docs/browser-assumptions-audit.md.
 */
export async function requestPermission() {
	return "prompt";
}
