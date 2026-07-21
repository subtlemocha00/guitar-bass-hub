# YouTube Embeds — Native Compatibility

Record of the embed audit run during Phase 2. **No code changes were made.**

Sections are split into what is **known** (observed in the current web app),
what is **expected** (analytical, needs testing against a real shell), and
**decisions still required**.

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

## Expected — Tauri

| Concern | Detail |
| --- | --- |
| CSP | If `tauri.conf.json` sets `security.csp`, it must include `frame-src https://www.youtube-nocookie.com`. A default-deny CSP blocks the iframe silently — a blank box, no error |
| Linux codecs | WebKitGTK relies on distro GStreamer plugins and rarely ships Widevine. Note `encrypted-media` is already in the `allow` list. Embedded playback may be partly or wholly unavailable on Linux **regardless of configuration** |
| Windows | WebView2 is Chromium-based; embeds are expected to behave as on the web |
| macOS | WKWebView; same inline-playback considerations as iOS |

## Expected — Capacitor

| Concern | Detail |
| --- | --- |
| Inline playback | WKWebView has historically required `allowsInlineMediaPlayback`; without it video takes over the screen in the native player. Capacitor exposes this, but defaults vary by version — verify against the version installed |
| Origin scheme | `iosScheme: 'https'` makes the embedding origin `https://localhost` instead of `capacitor://localhost`. Main lever against the origin risk below |
| Android fullscreen | `allowFullScreen` needs the host to implement `WebChromeClient.onShowCustomView`. If the bridge does not, the fullscreen button silently does nothing. Degrades rather than breaks — inline playback still works |
| Storage partitioning | `youtube-nocookie` still uses storage for playback state. Under WKWebView ITP a custom-scheme parent can have the frame's storage partitioned, surfacing as intermittent failures or bot-check prompts |
| Permissions | None. Playback requires no native permission |

## Expected — the custom-origin risk

The highest-risk item, and it is not about the code.

YouTube's embed evaluates the embedding origin. From `capacitor://` or
`tauri://` the `Referer` may be absent or unrecognised, which can produce
"Video unavailable" or a player that refuses to start. Mitigable by serving
from an `https://localhost`-style origin.

If configuration cannot fix it, the media experience needs a fallback — which
is a feature decision, not a bug fix.

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

Everything under **Expected** is analytical. No Tauri or Capacitor shell was
installed, and webview defaults shift between versions. Treat these as a
prioritised test plan, not settled facts — and test the origin scheme and one
YouTube embed early, since they gate the most user-visible features.
