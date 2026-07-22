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
| **Deferred to Capacitor** | 3 | virtual-keyboard overlap, status-bar theming, sticky-hover on touch |
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

- **Virtual-keyboard overlap.** Fix 5 stops the modal from *clipping*, but on iOS
  a `position: fixed` overlay is not resized when the keyboard appears, so the
  keyboard can still cover a centred dialog's lower fields. Fully solving this
  needs the keyboard height, which the web platform only exposes unreliably
  (`visualViewport`). Capacitor's `@capacitor/keyboard` (resize modes,
  `keyboardWillShow` height) is the right tool. Belongs to the Capacitor phase.
- **Status-bar theming.** The web metas (`theme-color`, `black-translucent`) are
  set, and the safe-area fix (1) makes content sit correctly beneath the bar. The
  bar's *style* (icon colour, background) on native is a `@capacitor/status-bar`
  concern, not a web-CSS one.
- **Sticky-hover on touch.** All `:hover` styles are subtle glows; on touch, a
  hover style can "stick" after a tap until the next interaction. Guarding every
  `:hover` with `@media (hover: hover)` would touch ~30 files and risk desktop
  regressions for a low-severity, self-clearing cosmetic effect. Better as its
  own focused pass than folded into this one.

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

1. **Virtual-keyboard resize** via `@capacitor/keyboard` (see Deferred).
2. **Status-bar and splash** via `@capacitor/status-bar` / `@capacitor/splash-screen`.
3. **On-device pass on real iOS/Android hardware** — emulation proved layout and
   overflow, but the actual notch inset rendering, momentum scrolling and the
   keyboard interaction can only be confirmed on device. This is the honest
   empirical gap and is naturally part of bringing up the mobile shell.
4. **Optional:** the sticky-hover `@media (hover: hover)` pass, and the
   incidental `--border` token fix — both independent of Capacitor.
