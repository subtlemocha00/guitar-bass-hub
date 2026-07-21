# Desktop Polish — First Pass

What changed to make the Tauri build feel like an application rather than a
wrapped website, what was deliberately left out, and what the next shell
(Capacitor) inherits.

Everything below was measured in the running release build on Windows, driven
over the WebView2 debugging protocol and through Win32 window messages. Where
something could not be verified on this hardware it says so.

---

## Implemented

### External links now reach the system browser

The largest real defect. `openExternal` called `window.open`, which the shell's
popup allow-list denies (correctly — see
[tauri-auth-investigation.md](tauri-auth-investigation.md)), so **every external
link on desktop silently did nothing**. Three surfaces were affected: song tab
links, and the tool cards on the Guitar and Bass pages.

`platform/links.js` became `platform/links/`, splitting the one line that
genuinely varies from the policy that must not:

| File | Owns |
| --- | --- |
| `index.js` | URL validation, anchor attributes, click interception — shared |
| `webLinks.js` | `window.open(url, "_blank", "noopener,noreferrer")` |
| `nativeLinks.js` | `@tauri-apps/plugin-opener` `openUrl(url)` |

Verified: clicking a tool card on `#/guitar` opens Chrome on
`all-guitar-chords.com`, the app stays on its route, and no in-app window is
created (`/json/list` shows one target before and after).

**`openExternal` is now async.** That is the contract every native shell can
meet — handing a URL to the OS is inherently asynchronous — and the web
implementation adapts to it trivially while the reverse is impossible. Same
reasoning as the storage driver in [storage.md](storage.md). No caller reads the
result today, so nothing changed at any call site.

### Window behaviour

| Behaviour | Implementation |
| --- | --- |
| Size and position remembered | `tauri-plugin-window-state` |
| First launch centred | `"center": true` in `tauri.conf.json` |
| Minimum size | 720×560 inner, down from 900×600 |
| Only one instance | `tauri-plugin-single-instance`, focuses and unminimises the existing window |

Both plugins are declared under a `cfg(not(android/ios))` target so a Tauri
mobile build would not try to compile them — the OS owns window geometry and
process lifetime there.

The minimum came down because 900×600 was a guess. At an emulated 704×505
viewport every route still lays out without horizontal scroll: the topbar wraps
to two rows and the metronome remains usable. Verified by dragging the window
corner past the limit — it stops at 736×599 outer, which is exactly 720×560 plus
the Windows frame.

### Focus handling in dialogs

Two real bugs, found by measurement rather than inspection:

1. **Tab escaped every dialog.** Six Tabs from the Add Song modal landed on the
   topbar brand link — behind a dimmed overlay, where Enter would activate
   something invisible.
2. **Closing a dialog dropped focus to `<body>`** instead of returning it to the
   control that opened it.

`components/useDialogFocus.js` fixes both for all three dialogs (ConfirmDialog,
AddSongModal, AddBackingTrackModal). It traps Tab and restores focus on close;
initial focus stays with each dialog, because the right starting element differs
and the existing choices were already correct.

This is **not** desktop-specific and is not gated on `isNative`. Keyboard users
hit it on the web too; it is merely more obvious in a packaged app, where Tab has
no browser chrome to escape into.

> **Three wrong fixes before the right one**, all from the same misunderstanding
> of React's commit order, and each looked correct until measured:
>
> 1. Reading `document.activeElement` when the trap installs → returns the
>    dialog's own field, because `autoFocus` is applied during commit, before any
>    effect runs.
> 2. Recording focus only while closed → the dialog's `autoFocus` fires before
>    the passive cleanup removes the listener, so it recorded the dialog's field
>    anyway.
> 3. Filtering those events by `containerRef.current.contains(target)` → refs
>    attach bottom-up, so the child's `autoFocus` fires while the parent
>    container ref is still `null`.
>
> The fix keeps the last *two* focused elements and, once effects run and refs
> are attached, takes whichever is not inside the dialog. Recorded here because
> the failure was silent every time: focus simply ended up on `<body>` and
> nothing threw.

Also fixed while here: **Escape during a save** closed the modal and discarded
the entered values. The close button already guarded on `submitting`; the Escape
handler did not.

### Version and runtime readout

Control Center's status card described a browser on desktop: `isStandalone()` is
true in a shell, so it read "STANDALONE / PWA", and "SERVICE WORKER: INACTIVE"
implied a fault rather than something inapplicable.

It now reads `VERSION 0.1.0` and `RUNTIME DESKTOP (TAURI)`, and the service
worker row is hidden on native. `platform.runtimeLabel()` is the single line
Capacitor extends.

One version for every target: `src-tauri/tauri.conf.json` uses
`"version": "../package.json"`, and `vite.config.js` injects the same value as
`VITE_APP_VERSION`. The binary, the installer and the in-app readout cannot
disagree.

---

## Verified, unchanged

| Check | Result |
| --- | --- |
| Resize | works; content reflows, no horizontal scroll on any route |
| Maximize / restore | correct, returns to the pre-maximize geometry |
| Graceful close | 62–82 ms, exit code 0 |
| Audio teardown on close | metronome running at close; **zero orphaned WebView2 processes**, system count returns to its pre-launch baseline |
| Escape / Enter / Space | Escape closes all three dialogs; Enter submits; Space toggles the metronome and is suppressed in inputs |
| Popup allow-list | still denies everything but the auth handler |

**Not verified: DPI above 100%.** This machine runs at 100% scaling, so
`devicePixelRatio` is 1 and a real HiDPI window could not be produced. Layout
was checked at an emulated `deviceScaleFactor: 2` (no horizontal scroll on any
route), which exercises the app's CSS but *not* the shell's DPI awareness. Tauri
ships a per-monitor-v2 DPI manifest, so this is expected to be handled by the
framework — expected, not tested.

**Partially verified: tuner teardown.** The metronome was confirmed running at
window close. The tuner page was opened and START pressed, but microphone
acquisition was not separately confirmed, so "the mic is released on close" rests
on the process tree exiting cleanly rather than on a direct observation.

---

## Deliberately not done

| Item | Why |
| --- | --- |
| Application menu | The app has its own navigation. A File/Edit menu would add chrome with nothing behind it, and Windows WebView2 already handles Ctrl+C/V/X/A in inputs without one |
| About dialog | The version readout in Control Center covers the need — a modal would be a second place to maintain for the same string |
| Reveal log / config location | The log plugin only runs in debug builds, so there is nothing useful to reveal in a release |
| Desktop-specific settings | No setting has appeared that should differ per platform. Adding a surface first and reasons later is how settings screens rot |
| Suppressing the WebView2 context menu | Right-clicking the page background produced no browser menu on this build, so there is nothing to suppress. Blanket suppression would also break Cut/Copy/Paste in text fields |

---

## What Capacitor inherits

Nothing here is Tauri-only except the two plugin registrations in `lib.rs`.

- **`platform/links/`** — mobile adds `Browser.open({ url })` in place of
  `nativeLinks.js`'s `openUrl`. The async contract, the safe-protocol list and
  the anchor interception are already shared, and the interception matters more
  on mobile, where `target="_blank"` inside a webview is reliably useless.
- **`platform.runtimeLabel()`** — extends to `MOBILE (IOS)` / `MOBILE (ANDROID)`.
- **`APP_VERSION`** — already build-time and platform-independent. If a mobile
  build ever needs the *store* version rather than the source version, that
  becomes a platform function; until then a constant is honest.
- **`useDialogFocus`** — not platform code at all, but it is what makes an
  external keyboard usable on a tablet.

Deliberately **not** generalised: window geometry and single-instance are
desktop concepts. Wrapping them in a platform module would produce two functions
that do nothing on every other target. See the deferred-abstraction table in
[architecture.md](architecture.md) for the standing rule.

---

## Reproducing the verification

Most of it needs the WebView2 debugging protocol, which needs a temporary
`additionalBrowserArgs` entry — see
[youtube-native-compatibility.md](youtube-native-compatibility.md#how-to-re-run-this)
for the exact string and the warning that comes with it. Window geometry,
minimum size, close timing and process teardown were driven through Win32
messages instead and need no build change.
