# Tauri Authentication — Investigation

**Status: investigation only. Nothing implemented, no decision locked in.**

The question: now that the Tauri PoC has shown the app runs from
`http://tauri.localhost` rather than a custom scheme, can the existing Firebase
popup flow be reused on desktop — avoiding a separate OAuth implementation?

**Short answer: probably not, but for a reason that has nothing to do with the
origin.** The origin discovery is genuinely good news; a different blocker sits
in front of it.

---

## Current architecture

| Piece | Value |
| --- | --- |
| `authDomain` | `practice-hub-00.firebaseapp.com` |
| Web sign-in | `signInWithPopup` + `GoogleAuthProvider` in `platform/auth/webAuth.js` |
| Native sign-in | `platform/auth/index.js` throws `AuthNotImplementedError` |
| Tauri origin | `http://tauri.localhost` |
| Shell | `tauri::Builder::default()` + log plugin — no custom handlers |
| Versions | tauri 2.11.5, tauri-runtime-wry 2.11.4, wry 0.55.1 |

Only credential *acquisition* is platform-specific. Every strategy below ends
in the same Firebase session, so `AuthProvider` and all consumers are
unaffected regardless of which is chosen.

---

## Findings

### Proven

**1. The origin is `http://tauri.localhost`.** Verified by deleting the
WebView2 profile's `IndexedDB` and `Local Storage` directories, relaunching,
and observing both recreated as `http_tauri.localhost_0`. An http origin with a
real hostname — not the `tauri://localhost` custom scheme earlier audits
assumed.

**2. The Firebase SDK initialises inside the webview.** The same wiped-profile
run recreated `firebaseLocalStorageDb`, `firebase-heartbeat-database` and
Firebase's `__sak` storage probe. The SDK loads, detects storage and persists.

**3. `window.open()` is suppressed in the current shell.** This is the blocker,
and it is in wry, not in Firebase. From `wry-0.55.1/src/webview2/mod.rs`, the
`NewWindowRequested` handler:

```rust
if let Some(new_window_req_handler) = &new_window_req_handler {
    // ... dispatch to the app's handler ...
} else {
    args.SetHandled(true)?;   // handled, but no window is ever created
}
```

`tauri-runtime-wry` only registers that handler when the app supplies one
(`if let Some(new_window_handler) = pending.new_window_handler`). Our
`lib.rs` is `tauri::Builder::default()` with no such handler, so
`window.open()` returns null. `signInWithPopup` calls `window.open()` and would
fail with `auth/popup-blocked`.

This is fixable — Tauri exposes the hook — so it is an obstacle, not a wall.

**4. No custom user agent is set.** Both wry and `tauri-runtime-wry` only apply
one when explicitly configured (`if let Some(user_agent)`), so WebView2 presents
its stock Chromium/Edge UA. Relevant to gate 2 below.

**5. The native auth boundary behaves as designed.** Unit-tested against the
real selection logic in `platform/auth/index.js` with `isNative` stubbed both
ways: web delegates to `webAuth`; native throws `AuthNotImplementedError`, names
the file to edit, and never silently falls back (10/10).

### Unknown — must be tested, not reasoned about

**A. Will Firebase Console accept `tauri.localhost` as an authorised domain?**
Syntactically it is a valid hostname and `.localhost` is a reserved TLD
(RFC 6761). `localhost` itself is authorised by default. Whether the Console's
validation accepts the `tauri.localhost` form is unverified — checking is a
one-minute Console visit, deliberately not done here.

**B. Will Google's OAuth consent screen accept WebView2?** Google blocks
embedded user agents for OAuth (`disallowed_useragent`) as anti-phishing
policy. WebView2 presents a stock Edge UA, so it may pass a UA heuristic — but
the policy targets exactly this scenario, and behaviour has changed over time.
**This is the highest-risk unknown**, and it is not something the origin
discovery helps with.

**C. Would `on_new_window` actually make the popup work end to end?** Even with
the handler registered and the domain authorised, the flow needs the popup to
load `https://<authDomain>/__/auth/handler`, complete Google sign-in, and
`postMessage` the credential back to `http://tauri.localhost`. Each step is
plausible; none is verified.

---

## Tested behaviour

| Check | Result | How |
| --- | --- | --- |
| Origin is `http://tauri.localhost` | confirmed | profile wipe + relaunch |
| Firebase SDK initialises | confirmed | IndexedDB + `__sak` recreated |
| App renders, storage hydrates, auth state resolves | confirmed | window capture (see [tauri-poc.md](tauri-poc.md)) |
| Native branch throws `AuthNotImplementedError` | confirmed | unit test |
| Clicking SIGN IN in the running app | **not observable** | see below |

The abstraction was not bypassed and no auth code was changed.

Clicking SIGN IN cannot be verified visually: the throw happens inside a React
event handler, error boundaries do not catch those, and Tauri does not forward
webview console output to stdout. There is no UI change to capture. The unit
test is the appropriate evidence for that behaviour.

---

## Options

### Option A — reuse `signInWithPopup` from `http://tauri.localhost`

Three independent gates, all of which must pass:

1. `window.open` must work → **currently fails**; needs an `on_new_window`
   handler in Rust.
2. `tauri.localhost` must be an authorised domain → unknown (finding A).
3. Google must accept WebView2 for OAuth → unknown, and historically hostile
   (finding B).

| | |
| --- | --- |
| Complexity | Low *if* all three gates pass — a Rust handler plus a Console entry, and `platform/auth` selects `webAuth` on native |
| Reliability | **Questionable.** Gate 3 is a third-party policy that can change without notice and would break sign-in for every installed desktop user at once |
| Maintenance | Low code, but an ongoing dependency on Google tolerating an embedded webview |
| Fits abstraction | Perfectly — native would simply reuse `webAuth` |

The appeal is obvious: near-zero code. The risk is that it depends on a policy
explicitly designed to prevent it.

### Option B — system browser OAuth + `signInWithCredential`

The approach Google documents for native apps (RFC 8252): open the consent
screen in the **real** browser, catch the redirect on a loopback listener,
exchange the code, then `GoogleAuthProvider.credential(idToken)` →
`signInWithCredential()`.

| | |
| --- | --- |
| Complexity | Higher — loopback listener, PKCE, token exchange. `tauri-plugin-oauth` covers the listener; `openExternal` already exists for launching the browser |
| Reliability | **High.** The sanctioned path; not subject to embedded-webview policy |
| Maintenance | Moderate — a client secret/PKCE flow and a redirect URI to keep configured |
| Fits abstraction | Cleanly — a `desktopAuth.js` behind the existing boundary; `AuthProvider` and consumers unchanged |

Requires Firebase Console work too: a desktop OAuth client, and its client ID
allow-listed under Authentication → Sign-in method → Google → Web SDK
configuration so Firebase will accept the resulting ID token.

### Option C — others considered

- **`signInWithRedirect`** — avoids `window.open`, but navigates the webview to
  the authDomain and back, so it still faces gate 3, plus cross-origin storage
  partitioning issues that Firebase has documented since v9.15. **Worse than A**;
  not recommended.
- **`tauri-plugin-oauth`** — not a separate strategy but the concrete
  accelerator for Option B's loopback listener.
- **Device authorisation grant** (code entered on another device) — avoids
  browsers entirely, works anywhere, but the UX is poor for a desktop app that
  can just open a browser. Keep only as a fallback if loopback is blocked.

---

## Where this points

**Leaning to Option B**, with the caveat that Option A is cheap enough to be
worth disproving rather than assuming.

The reasoning: Option A's cost is low but its risk sits with a third party. A
Google policy change would break sign-in for every installed desktop user
simultaneously, with a mandatory app update as the only remedy. Option B costs
more up front and then stops being a risk.

**This is a lean, not a decision.** Two cheap experiments would settle it, and
should be run before committing either way:

1. **Try adding `tauri.localhost` in Firebase Console** (one minute, reversible)
   — settles finding A.
2. **Register an `on_new_window` handler in a throwaway branch and attempt a
   real sign-in** — settles findings B and C together, and is the only way to
   learn whether Google accepts WebView2 here.

If experiment 2 succeeds, Option A becomes tempting; even then, weigh it
against the policy risk above. If it fails with `disallowed_useragent`, Option
B is the answer and no further investigation is needed.

---

## Unresolved questions

1. Does Firebase Console accept `tauri.localhost` as an authorised domain?
2. Does Google's consent screen reject WebView2 (`disallowed_useragent`)?
3. With `on_new_window` registered, does the popup complete and `postMessage`
   the credential back to `http://tauri.localhost`?
4. For Option B: which OAuth client type, and does the Web SDK configuration
   allow-list accept a desktop client ID for this project?
5. How should sign-in behave when the app is offline? Firestore has a
   persistent cache, but auth does not — a returning user with no network
   currently sees a signed-out app.
6. Capacitor is unexamined; `capacitor://localhost` remains a custom scheme
   unless `iosScheme: 'https'` is set, so mobile may still need its own answer
   regardless of what desktop chooses.
