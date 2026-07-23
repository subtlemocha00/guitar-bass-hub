# Mobile Readiness Audit

A complete UX, interaction and layout audit of the app under mobile browsers
(Chrome on Android, Safari on iOS), while it still runs as a normal web app. The
goal is to eliminate problems that would immediately surface once the app is
wrapped by Capacitor — **without** installing Capacitor, adding plugins, or
changing desktop behaviour.

Companion to [browser-assumptions-audit.md](browser-assumptions-audit.md) (which
covered JS/API assumptions); this one covers CSS, layout and touch interaction.

**Result in one line:** the responsive foundation was already sound (breakpoints,
`overflow-x: hidden`, wide content scrolling in its own containers, touch-ready
drag-and-drop), but it ignored the *device frame* — no safe-area handling despite
opting into `viewport-fit=cover`, `100vh` instead of `dvh`, sub-16px inputs that
trigger iOS zoom, sub-44px touch targets, and modals that could clip on short
viewports. All five are fixed with additive, touch-scoped CSS that is provably
inert on desktop.

---

## Executive summary

| Bucket | Count | Items |
| --- | --- | --- |
| **Fixed** | 6 | safe-area insets, `dvh` heights, iOS input-zoom, 44px touch targets, modal overflow, mobile quirks reset |
| **Deferred to Capacitor** | 3 | virtual-keyboard overlap, status-bar theming, sticky-hover on touch (first two **resolved in Phase 7** — see below; splash white-flash also fixed there) |
| **No action required** | 6 | drag-and-drop (already touch-ready), fretboard overflow (already scoped), responsive breakpoints, body overflow guard, hover-only interactions (none exist), animation performance |
| **Incidental (out of scope)** | 1 | undefined `--border` token in Setlist.css (a shared bug, not mobile-specific) |

Every fix satisfies all four required gates: benefits mobile web **and** future
Capacitor, does not reduce desktop usability, is architecture-neutral (CSS only),
and is backed by evidence (device-frame behaviour + a CDP measurement sweep).

---

## How this was verified

Beyond lint / web build / Tauri build, the responsive claims were **measured**,
not eyeballed. Microsoft Edge was driven over the Chrome DevTools Protocol with
mobile emulation (`Emulation.setDeviceMetricsOverride` + touch emulation, which
makes `pointer: coarse` match), navigating 8 routes across 5 viewports:

| Viewport | Size |
| --- | --- |
| iPhone SE portrait | 375 × 667 |
| iPhone 12 portrait | 390 × 844 |
| Pixel 7 portrait | 412 × 915 |
| iPhone 12 landscape | 844 × 390 |
| Small | 320 × 568 |

For each it recorded `scrollWidth − innerWidth` (horizontal overflow), the
computed control height, and the computed input font-size.

**This caught a real defect.** The first pass showed inputs still computing at
12.48px / 13.12px on touch — the 16px rule was silently losing on specificity
(`.song-sort-select` as a class outranks a bare `select` selector). It was fixed
with `!important` (justified below) and re-measured: **16px everywhere, zero
horizontal overflow on every route and viewport, controls 44px tall.** The
analytical argument alone would have shipped a broken zoom fix.

---

## Fixed

### 1. Safe-area insets were entirely absent — HIGH

- **Location:** [index.css](../src/index.css) `.page`; [Layout.css](../src/components/Layout.css) `.topbar`, `.layout-footer`; [AddSongModal.css](../src/features/songs/AddSongModal.css) and [ConfirmDialog.css](../src/components/ConfirmDialog.css) overlays.
- **Description:** `index.html` opts into `viewport-fit=cover` and
  `apple-mobile-web-app-status-bar-style: black-translucent`, which deliberately
  extend content under the iOS status bar, notch and home indicator — but nothing
  in the CSS used `env(safe-area-inset-*)` to compensate.
- **Desktop:** no notch, insets are always 0 → unaffected.
- **Mobile:** on a notched iPhone the sticky top bar rendered under the status
  bar (portrait) and behind the notch (landscape); the footer sat under the home
  indicator; page content in landscape ran under the side notch.
- **Fixed?** Yes. The sticky top bar adds `env(safe-area-inset-top)` to its top
  padding and the side insets to its horizontal padding; the footer adds the
  bottom inset; `.page` adds the side insets; both modal overlays use
  `max(1rem, env(safe-area-inset-*))` so the dialog never hides under the frame.
- **Rationale:** the app already told the OS "draw me edge to edge"; this makes
  it honour the promise. `env()` is 0 on every desktop, so the change is a no-op
  off mobile. Also directly required for Capacitor, which renders full-bleed.

### 2. `100vh` ignored the mobile dynamic toolbar — MEDIUM

- **Location:** [index.css](../src/index.css) — `html, body, #root` and `.shell`.
- **Description:** heights used `min-height: 100vh`. On mobile, `100vh` is the
  *large* viewport (toolbar retracted), so with the address bar showing, the
  shell is taller than the visible area.
- **Desktop:** `dvh` equals `vh` (no dynamic toolbar) → identical.
- **Mobile:** slight over-scroll and a footer that starts below the fold until
  the toolbar hides.
- **Fixed?** Yes. Added `min-height: 100dvh` immediately after each `100vh` line
  — progressive enhancement: engines with `dvh` use it, older engines keep the
  `vh` fallback.
- **Rationale:** one-line, zero desktop impact, standard fix for the toolbar
  resize that both mobile web and a Capacitor webview exhibit.

### 3. iOS zoom-on-focus for sub-16px form controls — HIGH

- **Location:** [index.css](../src/index.css) touch block; affects every
  control (`.add-song-input` 0.9rem, `.song-sort-select`/`.metro-select`/
  `.tuner-tuning-select` 0.78–0.82rem, `.mp-input` 0.74rem, `.song-card-notes`
  textarea 0.78rem).
- **Description:** Safari zooms the page when a focused control's font is under
  16px, then leaves the layout shifted. Every control in the app qualified.
- **Desktop:** no such behaviour → unaffected.
- **Mobile:** tapping any field (add-song, notes, sort, tuner tuning, metronome)
  yanked the viewport in.
- **Fixed?** Yes. `@media (pointer: coarse) { input, select, textarea { font-size: 16px !important } }`.
- **Rationale:** `!important` is deliberate and necessary — each control's
  class-based font-size outranks a bare element selector, so without it the rule
  loses on specificity (proven by the CDP measurement above). It also future-
  proofs the invariant for controls added later. Scoped to `pointer: coarse`, so
  desktop keeps the design's smaller type. Applies equally in a Capacitor iOS
  webview.

### 4. Touch targets below the 44px minimum — HIGH

- **Location:** [index.css](../src/index.css) touch block; enumerated control
  classes across header, modals, song cards, backing-track cards, setlist,
  filters, fretboard, tuner and metronome.
- **Description:** every button measured 24–36px tall (e.g. `.auth-btn` ≈ 28px,
  `.song-card-status`/`.song-card-edit`/`.song-card-remove` ≈ 28px), under the
  Apple HIG 44pt / WCAG 2.5.5 minimum.
- **Desktop:** precise mouse pointer, current density is appropriate →
  unaffected.
- **Mobile:** fiddly, error-prone tapping, especially the header auth control and
  the per-card action row.
- **Fixed?** Yes. `@media (pointer: coarse) { … { min-height: 44px } }` over the
  enumerated interactive classes, plus `min-width: 44px` on the square modal
  close button. Verified at 44px in the CDP sweep.
- **Rationale:** `min-height` only grows, never restructures, so nothing reflows;
  `pointer: coarse` excludes touch-capable laptops (whose primary pointer is
  fine), keeping desktop density. Decorative indicators (metronome pulse dots,
  the setlist drag handle) are intentionally omitted — they are not tap targets.

### 5. Modals could clip and be unscrollable on short viewports — MEDIUM

- **Location:** [AddSongModal.css](../src/features/songs/AddSongModal.css)
  `.add-song-modal`; [ConfirmDialog.css](../src/components/ConfirmDialog.css)
  `.confirm-dialog`.
- **Description:** overlays centre the dialog (`align-items: center`) with no
  `max-height`/`overflow`. A dialog taller than the viewport overflowed equally
  top and bottom, clipping the top off-screen with no way to scroll to it.
- **Desktop:** dialogs are short relative to an 800px+ window → never triggered.
- **Mobile:** the multi-field Add-Song modal in landscape (~390px tall), or in
  portrait with the keyboard halving the height, lost its top.
- **Fixed?** Yes. Both dialogs get `max-height: calc(100dvh - 2rem)` (with a `vh`
  fallback) and `overflow-y: auto`, so they scroll internally instead of
  clipping.
- **Rationale:** the cap only engages when the dialog would exceed the viewport,
  which never happens on desktop; standard modal-on-mobile pattern.

### 6. Mobile browser-quirk reset — LOW

- **Location:** [index.css](../src/index.css) — `html` and `body`.
- **Description:** two established mobile-quirk fixes were missing.
- **Fixed?** Yes. `-webkit-text-size-adjust: 100%` on `html` stops iOS inflating
  text on rotation to landscape; `-webkit-tap-highlight-color: transparent` on
  `body` removes the grey tap flash that clashes with the dark neon theme.
- **Rationale:** both are cosmetic, touch-only, and have no rendering effect on
  desktop.

---

## Deferred to Capacitor

Documented rather than implemented, because a correct fix needs the native shell.
The first two were **resolved in Phase 7** (see "Resolved in the Capacitor phase"
below); the third is still open.

- **Virtual-keyboard overlap.** Fix 5 stops the modal from *clipping*, but on iOS
  a `position: fixed` overlay is not resized when the keyboard appears, so the
  keyboard can still cover a centred dialog's lower fields. Fully solving this
  needs the keyboard height, which the web platform only exposes unreliably
  (`visualViewport`). Capacitor's `@capacitor/keyboard` (resize modes,
  `keyboardWillShow` height) is the right tool. Belongs to the Capacitor phase.
  **→ Resolved in Phase 7.**
- **Status-bar theming.** The web metas (`theme-color`, `black-translucent`) are
  set, and the safe-area fix (1) makes content sit correctly beneath the bar. The
  bar's *style* (icon colour, background) on native is a `@capacitor/status-bar`
  concern, not a web-CSS one. **→ Resolved in Phase 7.**
- **Sticky-hover on touch.** All `:hover` styles are subtle glows; on touch, a
  hover style can "stick" after a tap until the next interaction. Guarding every
  `:hover` with `@media (hover: hover)` would touch ~30 files and risk desktop
  regressions for a low-severity, self-clearing cosmetic effect. Better as its
  own focused pass than folded into this one. **→ Still open** (independent of
  Capacitor; not part of Phase 7).

---

## Resolved in the Capacitor phase (Phase 7)

The mobile-shell polish pass. The rule throughout: **inspect Capacitor 8's actual
defaults before configuring**, add nothing speculative, and change CSS/layout only
where a genuine device-frame issue exists (there were none left — the audit above
had already fixed them). Two plugins were added, both justified below; the
abstraction boundaries were preserved and no platform check entered a feature
module.

### Keyboard handling — `@capacitor/keyboard` (native-only, no JS)

The deferred overlap is fixed by the plugin's **default `resize: "native"` mode**
(confirmed in the plugin's `definitions.d.ts`: `@default native`, iOS): the whole
WebView resizes when the keyboard opens, so a `position: fixed` modal reflows into
the shrunken viewport above the keyboard instead of being covered. That behaviour
is applied entirely by the native plugin once it is installed and synced — it
needs **no JavaScript and no `resize` config** (setting it would just restate the
default, which the discipline forbids). So the plugin is imported nowhere in JS;
it is a pure native dependency. The only Keyboard config is a declarative
`Keyboard.style: "DARK"` in `capacitor.config.json`, so the on-screen keyboard
matches the permanently-dark UI instead of following the device's light/dark
setting (iOS). No CSS changed — the existing `dvh`/`max-height` modal rules from
fix 5 do the rest once the viewport resizes.

### Status-bar theming — `@capacitor/status-bar` via a new `@nativeui-impl` alias

Themed to the dark UI: **light icons** (`Style.Dark` = "light text for dark
backgrounds") on both platforms. iOS keeps the status bar as a translucent overlay
(its platform convention) — the WebView already extends underneath it and the
`env(safe-area-inset-top)` padding from fix 1 keeps the topbar clear. Android
follows *its* convention — a solid bar — so at runtime we call
`setOverlaysWebView(false)` + `setBackgroundColor(#05021f)` there; this also avoids
relying on Android's less-reliable CSS safe-area insets and sidesteps the
documented Android full-screen keyboard-resize bug. `capacitor.config.json` sets
`StatusBar.style: "DARK"` so the very first frame already has light icons before
JS runs.

Because `@capacitor/status-bar` calls `registerPlugin()` at import time, it sits
behind a **new build alias `@nativeui-impl`** (mirroring `@lifecycle-impl`):
`capacitorNativeUI.js` for Capacitor, `webNativeUI.js` (a no-op that imports
nothing) for web and Tauri. `platform.js` re-exports `initNativeUI`, which
`main.jsx` calls once after first paint. An inline `if (isCapacitor)` would have
leaked the plugin into the browser and desktop bundles — the same reason the other
four boundaries are aliased. The bootstrap is wrapped in `try/catch`: on web/Tauri
(and desktop verification) the plugin is unavailable and the call degrades to a
single warning with **zero errors**.

### Splash — white-flash removal by native config (no plugin)

The generated splash was a **white** image on a **white** `systemBackgroundColor`
(iOS `LaunchScreen.storyboard`) and a white `@drawable/splash` (Android) — a
white flash on a dark app. No splash-screen *plugin* was added: the genuine issue
is only colour, and a plugin would add a post-load splash overlay with its own
duration, which "avoid excessive display duration / preserve fast startup"
explicitly argues against. Instead, three coordinated native settings make the
launch → WebView → first-paint handoff one continuous dark surface (`#05021f`, the
app's real `--bg-0`):

| Layer | Change |
| --- | --- |
| WebView background | `backgroundColor: "#05021f"` in `capacitor.config.json` — the frame revealed when the launch screen dismisses is dark, not white (both platforms) |
| iOS launch screen | `LaunchScreen.storyboard` — removed the white image, set the view's background to `#05021f` |
| Android launch window | new `colors.xml` `splashBackground #05021F`; launch theme `android:background` now `@color/splashBackground` instead of `@drawable/splash` |

CDP confirmed the served build paints `body` at exactly `rgb(5, 2, 31)`, so the
handoff target matches.

### Verified only — no change was warranted

The remaining objectives were inspected and found already-correct; changing them
would have been speculative:

- **Safe areas.** Already handled by fixes 1/5 (topbar/footer/page/modals use
  `env(safe-area-inset-*)`). Re-verified: 0 horizontal overflow, portrait and
  landscape. The status-bar choice above keeps those insets meaningful (iOS
  overlay) or moot (Android solid bar).
- **Overscroll / momentum.** `overflow-x: hidden` on `body` already blocks
  accidental horizontal scroll (0px overflow measured); momentum scrolling is the
  WebView default; vertical rubber-band is *expected* native behaviour, not an
  "unwanted" effect. Adding `overscroll-behavior` would have changed real-browser
  (web-target) swipe-nav behaviour for no genuine defect, so it was not added.
- **Orientation.** `Info.plist` already permits portrait + both landscapes and the
  Android activity handles orientation config changes; landscape layout measured
  clean. **Not locked** — there is no architectural reason to, and the objective
  forbids a gratuitous lock.
- **General polish.** Tap targets (44px), viewport sizing (`dvh`), modal centering
  and safe-area padding were all done in the audit above; fixed elements
  (`.bg-stage`) are correct; soft-keyboard resize is the keyboard item above.
  One minor observation left as an independent follow-up (not a Phase 7 fix, to
  avoid modal-component churn): the page can still scroll behind an open modal —
  a body-scroll-lock is a deliberate behaviour change, not compatibility work.

### Plugins added (2) — justification

| Plugin | Why required | Bundle |
| --- | --- | --- |
| `@capacitor/status-bar` | Theme the native status bar (light icons; Android solid dark bar) to the dark UI — a native-only surface with no CSS equivalent | Capacitor JS only, via `@nativeui-impl` |
| `@capacitor/keyboard` | Enable the native `resize: "native"` WebView behaviour so modals/inputs are not covered by the keyboard (the deferred overlap) | **Native only** — imported in no JS bundle |

---

## No action required

- **Setlist drag-and-drop is already touch-ready.** [Setlist.jsx](../src/pages/Setlist.jsx)
  uses `@dnd-kit` `PointerSensor` (Pointer Events work on touch) with
  `touch-action: none` on the handle, so a drag doesn't fight the page scroll.
  Nothing to change.
- **Fretboard horizontal overflow is already contained.** [Fretboard.css](../src/features/fretboard/Fretboard.css)
  wraps the wide SVG in `.fb-svg-wrap { overflow: auto }` with `min-width: 640px`
  on the SVG, so it scrolls inside its own box — the page never scrolls
  sideways. This is the correct pattern and is confirmed by the overflow sweep.
- **Responsive breakpoints already collapse layouts.** The hero strip, add-song
  grid, fretboard grid, song card and top bar all have breakpoints that go
  single-column on narrow screens; the CDP sweep found zero overflow down to
  320px.
- **`overflow-x: hidden` on `body`** already guards against accidental sideways
  scroll — kept.
- **Hover-only interactions: none exist.** Audited every `:hover`; all are
  decorative (colour/glow/transform). No control is revealed only on hover
  (no `opacity: 0 → :hover` pattern), so touch users lose no functionality.
- **Animation performance.** Animations are limited `opacity`/`transform` keyframes
  (pulse dots, glitch, flicker) — GPU-friendly and cheap. No layout-thrashing
  animation to address.

---

## Incidental finding (out of scope)

[Setlist.css](../src/pages/Setlist.css) references `var(--border)`, which is not
defined in the token set (the tokens are `--line-dim`/`--line-mid`/`--line-strong`).
The declarations fall back to `currentColor`. This is a **shared** bug — it looks
identical on desktop and mobile — so it is outside a mobile-readiness audit and
was left untouched. Flagged here so it can be fixed deliberately as a styling
change, not smuggled into this pass.

---

## Architecture rationale

- **Nothing structural changed.** No screen was redesigned, no component
  restructured, no breakpoint moved. Every fix is additive CSS — insets, a `dvh`
  line, a `max-height`, and one touch-scoped block. The existing responsive
  design was largely right; it just didn't account for the physical device frame.
- **Desktop is untouched by construction, not by testing luck.** `env()` is 0
  without a notch; `dvh` equals `vh` without a dynamic toolbar; the entire touch
  block lives behind `@media (pointer: coarse)`, which a desktop's fine pointer
  never matches. This is why the four required gates all hold.
- **`pointer: coarse`, not `any-pointer: coarse`.** The narrower query targets
  devices whose *primary* input is touch (phones, tablets) and deliberately
  excludes touch-capable laptops, so desktop density is never inflated.
- **One concern per fix.** Safe-area, viewport height, input zoom, tap size,
  modal overflow and the quirks reset are independent; each is expressed once, in
  the most global file that owns it.

---

## Verification performed

| Check | Result |
| --- | --- |
| Lint | Clean — `eslint .` no errors |
| Web build | Clean — 74 precache entries |
| Native (Vite) build | Clean — `index` 354.35 kB |
| Tauri release build | Built in 2m38s; binary launches with its window (desktop regression check). The later one-token `!important` addition is inert on desktop's fine pointer and does not touch Rust |
| Responsive sweep (CDP) | 8 routes × 5 viewports (320–844px, portrait + landscape): **horizontal overflow 0px everywhere** |
| Touch targets | Controls measured **44px** on `pointer: coarse` |
| Input zoom | Form controls measured **16px** on `pointer: coarse` (was 12.48–13.12px before the specificity fix) |
| Accessibility | No regression: targets grew, contrast/markup unchanged, no `:hover`-only affordance existed to break |

---

## Remaining work before / during the Capacitor phase

1. ~~**Virtual-keyboard resize** via `@capacitor/keyboard`.~~ **Done (Phase 7)** —
   native `resize: "native"` default; see "Resolved in the Capacitor phase".
2. ~~**Status-bar and splash.**~~ **Done (Phase 7)** — status bar via
   `@capacitor/status-bar` (`@nativeui-impl` alias); splash white-flash via native
   background config, **no splash-screen plugin** (it would only add duration).
3. **On-device pass on real iOS/Android hardware** — still open. Emulation and CDP
   proved layout, overflow and clean boot, but these are **device-only**: the
   actual notch/safe-area rendering, momentum/rubber-band feel, the keyboard
   `resize: "native"` reflow, the light status-bar icons and Android solid bar, and
   the dark cold-start launch screen can only be confirmed on device. This is the
   honest empirical gap and is naturally part of bringing up the mobile shell.
4. **Optional, still open:** the sticky-hover `@media (hover: hover)` pass, the
   incidental `--border` token fix, and a body-scroll-lock behind open modals —
   all independent of Capacitor.
