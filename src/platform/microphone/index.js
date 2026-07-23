// Microphone — the single seam for live audio-input acquisition and permission.
//
// WHY THIS EXISTS
// The tuner needs a live MediaStream for real-time pitch detection. Getting one
// is the same getUserMedia call in every WebView, but the *permission* model
// differs: on the web and Tauri the prompt is folded into getUserMedia, while a
// packaged mobile app needs an OS permission declared in native config and
// delivered through Capacitor's WebView bridge. Centralising acquisition here
// keeps useTuner platform-agnostic — it never touches navigator.mediaDevices,
// Capacitor, Android or iOS.
//
// API (both implementations expose the same three):
//   requestPermission()   -> "granted" | "denied" | "prompt"   (never throws)
//   acquireStream()       -> MediaStream                        (throws named errors)
//   stopStream(stream)    -> void
//
// WHY A COMPILE-TIME BOOLEAN, NOT A @…-impl ALIAS
// Unlike auth / storage / lifecycle / links, the Capacitor implementation imports
// NO Capacitor plugin — the live stream is the WebView's own getUserMedia and the
// permission is native config, not a JS import. With no registerPlugin() side
// effect anywhere in the module graph there is nothing an alias would keep out of
// the web/Tauri bundles, so the source-level `isCapacitor ? …` branch is correct
// and folds/tree-shakes cleanly. This is the same in-source form platform/links
// used before Phase 4 — and the honest opposite of the plugin boundaries, which
// had to move to an alias precisely because their native branch imports a plugin.
// See docs/architecture.md.

import { isCapacitor } from "../platform";
import * as webMicrophone from "./webMicrophone";
import * as capacitorMicrophone from "./capacitorMicrophone";

// isCapacitor is a build-time constant, so the unused branch folds away and the
// other implementation tree-shakes out of the bundle entirely.
const impl = isCapacitor ? capacitorMicrophone : webMicrophone;

export function requestPermission() {
	return impl.requestPermission();
}

export function acquireStream() {
	return impl.acquireStream();
}

export function stopStream(stream) {
	return impl.stopStream(stream);
}
