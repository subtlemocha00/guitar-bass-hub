# YouTube Embeds — Native Compatibility

Record of the embed audit run during Phase 2, plus the Tauri measurements that
resolved it. **No code changes were made.**

**Status: the Tauri risks are resolved. Embeds work under
`http://tauri.localhost` — verified by driving the running desktop app over the
WebView2 debugging protocol.** See [Measured — Tauri](#measured--tauri). The
Capacitor section below remains analytical.

The audit's central worry — that a native origin would make YouTube refuse to
play — was wrong for Tauri, for the same reason the auth forecast was wrong:
the origin is an ordinary http origin with a real hostname, not a custom scheme.

Sections are split into what is **known** (observed in the current web app),
what is **measured** (observed in the running Tauri app), what is **expected**
(analytical, still untested), and **decisions still required**.

---

## Known — current architecture

Three `<iframe>` declarations serving **four** surfaces. The setlist is easy to
miss: it reuses `VideoPlayer`, so a change there affects songs *and* setlist.

| # | Location | Consumers |
| --- | --- | --- |
| 1 | `features/songs/YouTubeEmbed.jsx` (`VideoPlayer`) | `SongCard`, `Setlist` |
| 2 | `features/backingTracks/BackingTrackCard.jsx` | backing tracks |
| 3 | `pages/BlogPost.jsx` | blog `link` blocks |

**URL generation.** `extractYoutubeId()` in `features/songs/youtubeUtils.js`
accepts a watch URL, a `youtu.be` short URL, or a bare 11-character ID and
returns the ID. That ID is templated into:

```text
https://www.youtube-nocookie.com/embed/${id}
```

**No query parameters at all** — no `autoplay`, no `origin`, no `enablejsapi`.

**Attributes**, byte-identical at all three sites:

```text
allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
allowFullScreen
loading="lazy"
```

No `sandbox`, no `referrerPolicy`. Containers are `aspect-ratio: 16/9` with
`overflow: hidden` and the iframe at 100% — sizing is pure CSS, with no
JavaScript measurement to misbehave in a webview.

## Known — why no code changes were made

Nothing is broken today, and the audit brief required a demonstrated current
issue before touching code. Every risk below is either native configuration or
unverifiable without a shell installed. Changing embed code speculatively would
have meant altering working behaviour on the only platform that currently ships.

Two properties of the current implementation are already favourable and worth
preserving:

- **Autoplay is permitted but never requested.** `allow="autoplay"` grants
  permission; no embed asks for it. This removes the single most common webview
  media problem outright.
- **Attributes are consistent across all three sites**, so there is one
  behaviour to reason about rather than three.

## Measured — Tauri

Windows, WebView2 `Edg/150.0.4078.83`, release build. The app was driven over
the WebView2 remote debugging protocol: navigation and clicks went through the
real input pipeline, and player state was read from inside the YouTube frame,
which is a separate out-of-process target.

| Concern | Result |
| --- | --- |
| Origin | `http://tauri.localhost`. `isSecureContext` is **true** — Chromium treats `*.localhost` as trustworthy |
| Referrer | `document.referrer` inside the frame is `http://tauri.localhost/`. It is sent, and YouTube accepts it |
| CSP | **None.** `security.csp` is `null`, and the protocol handler sends no `Content-Security-Policy` header at all. Nothing is blocked. If a CSP is ever added it must include `frame-src https://www.youtube-nocookie.com` |
| Iframe load | 200 for the embed document, player CSS/JS, `i.ytimg.com` thumbnail, `youtubei/v1/log_event` and `generate_204`. **No failed requests, no non-2xx responses** |
| Playback | Confirmed. Trusted click on the player → `paused: false`, `currentTime` advancing 1.97 → 5.98 → 10.99 s, `duration: 270.2`, `readyState: 4`, captions rendering. Screenshotted |
| Fullscreen | `document.fullscreenEnabled` is true; `requestFullscreen()` succeeded, `fullscreenElement` set, viewport became 1920×1080, playback continued, exit clean |
| Console errors | **None**, across every surface tested |
| Navigation away and back | Iframes unmount and their debugger targets disappear; returning re-creates and replays cleanly. No leaked frames |
| Multiple videos in one session | Works sequentially. Opening a second card closes the first — that is the existing single-`videoOpen` design, not a native constraint |

One difference from the web worth recording: wry launches WebView2 with
`--autoplay-policy=no-user-gesture-required` by default (`autoplay: true` in its
attributes, which Tauri does not override). Desktop is therefore *more*
permissive about media than a browser. It changes nothing today because no embed
requests autoplay — but the "autoplay is permitted and never requested" property
noted below is now the only thing preventing videos from starting by themselves.

### Storage partitioning is real but harmless

70 warnings of the form:

```text
Tracking Prevention blocked access to storage for https://www.youtube-nocookie.com/...
```

This is Edge Tracking Prevention (Balanced by default in WebView2) refusing
third-party storage to the embed. It is the partitioning risk the audit
predicted — and it changes nothing that matters: `document.cookie` is empty
inside the frame, `localStorage` is writable, the player loads, playback runs
and telemetry returns 200/204. `youtube-nocookie` is designed for exactly this.

Worth knowing rather than acting on: it means playback position and preferences
will not persist between sessions on desktop.

### The sample backing tracks are dead content, not a platform failure

Four of the five sample tracks fail, and one is embed-restricted:

| Video | Result |
| --- | --- |
| `jfKfPfyJRdk` (guitar) | "This live stream recording is not available." |
| `lTRiuFIWV54` (guitar) | Loads, refuses inline playback — "Watch on YouTube" overlay linking to `youtube.com/watch`. Owner disabled embedding |
| `hG4dfHs9pfk` (guitar) | "Video unavailable" |
| `oRRr4PLEEX0` (bass) | "Video unavailable" |
| `YsNQ0fUbVNk` (bass) | "Video unavailable" |

**This is not a Tauri problem.** The same build was driven from
`http://localhost:4173` in the same WebView2 — the only variable being the
embedding origin — and every one produced the identical state and identical
error string. `sampleBackingTracks.js` is placeholder data whose video IDs have
rotted; it is equally broken on the deployed web app.

Left alone deliberately: it is content, no user's own data is affected, and the
brief was not to change working code. Worth fixing separately.

One interaction to note: the "Watch on YouTube" overlay opens a new window,
which the shell's popup allow-list now denies. On desktop that affordance is
dead — the same as every other external link until `platform/links.js` gets its
native implementation. Not a regression; WebView2 discarded those requests
before the allow-list existed too.

### Not yet tested

Songs and setlist embeds. Both need a signed-in session to render any card, and
sign-in inside the desktop app was still outstanding when this was measured.
They share `VideoPlayer` from `features/songs/YouTubeEmbed.jsx`, whose iframe
markup is byte-identical to the two declarations that were tested — so they are
*expected* to behave identically. That is reasoning, not measurement.

## Expected — Tauri on other platforms

| Concern | Detail |
| --- | --- |
| Linux codecs | WebKitGTK relies on distro GStreamer plugins and rarely ships Widevine. Note `encrypted-media` is already in the `allow` list. Embedded playback may be partly or wholly unavailable on Linux **regardless of configuration** |
| macOS | WKWebView; same inline-playback considerations as iOS |

## Expected — Capacitor

| Concern | Detail |
| --- | --- |
| Inline playback | WKWebView has historically required `allowsInlineMediaPlayback`; without it video takes over the screen in the native player. Capacitor exposes this, but defaults vary by version — verify against the version installed |
| Origin scheme | `iosScheme: 'https'` makes the embedding origin `https://localhost` instead of `capacitor://localhost`. Main lever against the origin risk below |
| Android fullscreen | `allowFullScreen` needs the host to implement `WebChromeClient.onShowCustomView`. If the bridge does not, the fullscreen button silently does nothing. Degrades rather than breaks — inline playback still works |
| Storage partitioning | `youtube-nocookie` still uses storage for playback state. Under WKWebView ITP a custom-scheme parent can have the frame's storage partitioned, surfacing as intermittent failures or bot-check prompts |
| Permissions | None. Playback requires no native permission |

## The custom-origin risk — resolved for Tauri, open for Capacitor

This was ranked the highest risk in the audit: YouTube's embed evaluates the
embedding origin, and from a custom scheme the `Referer` may be absent or
unrecognised, producing "Video unavailable" or a player that refuses to start.

**For Tauri that risk does not exist.** The premise was that the origin would be
`tauri://localhost`. It is `http://tauri.localhost` — an ordinary http origin
with a real hostname, so the referrer is sent normally and the embed treats it
like any other site. Measured, not assumed.

The same mistake produced the pessimistic authentication forecast; see
[tauri-auth-investigation.md](tauri-auth-investigation.md). Both were reasoned
correctly from a wrong premise about the origin, and both were cheap to check.

For Capacitor the risk stands: `capacitor://localhost` *is* a custom scheme
unless `iosScheme: 'https'` is set. If configuration cannot fix it, the media
experience needs a fallback — a feature decision, not a bug fix.

## Decisions still required

### Fallback UX

`platform/links.js` already provides the right primitive: `openExternal(url)`.
Three gaps to settle before building anything:

1. **Detection is not possible.** The iframe is cross-origin, so the parent
   cannot read its content, and `onError` does not fire for in-document
   failures like YouTube's own "Video unavailable" screen. **An automatic
   fallback cannot be implemented.** It must be a user-initiated affordance
   ("Open on YouTube" beside the player) or a build-target decision
   (`isNative` → link instead of embed).
2. **The blog has no watch URL.** Blog `link` blocks carry only `youtubeId`.
   `SongCard`, `BackingTrackCard` and `Setlist` all have `youtubeUrl`
   available. A fallback would need an ID → watch-URL helper, the inverse of
   `extractYoutubeId`, which does not exist today.
3. **Always-on or conditional?** Showing an "Open on YouTube" control on every
   platform is simpler and testable on the web; showing it only on native
   splits the UX.

### Linux desktop support expectations

Decide explicitly whether Tauri on Linux is a supported target. If it is,
embedded playback may be unreliable there for reasons outside this codebase,
and the fallback above stops being optional. If Linux is best-effort, that
should be written down rather than discovered by a user.

---

## Confidence

**Measured — Tauri** is observation from the running release app on Windows:
navigation and clicks through the real input pipeline, player state read from
inside the YouTube frame. Songs and setlist are the one gap, and are reasoning
rather than measurement.

Everything under **Expected** remains analytical — no Capacitor shell is
installed, Linux and macOS were not tested, and webview defaults shift between
versions. Treat those as a prioritised test plan, not settled facts.

### How to re-run this

No code change is needed, but one temporary config change is. Add to the window
in `tauri.conf.json`:

```json
"additionalBrowserArgs": "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required --remote-debugging-port=9222"
```

Those first two flags are wry's defaults — setting `additionalBrowserArgs`
replaces them rather than appending, so they have to be repeated or the build
under test is not the build that ships. Rebuild, launch, and drive
`http://127.0.0.1:9222`; the YouTube frame appears in `/json/list` as its own
`iframe` target with its own debugger URL.

**Revert it before committing.** An open debugging port lets any local process
attach to the webview, so it must never reach a build anyone signs into.
