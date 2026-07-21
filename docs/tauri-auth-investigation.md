# Tauri Authentication — Investigation and Implementation

**Status: Option A validated and implemented. Sign-in through Google's
credential prompt is confirmed in the production build; completing a sign-in
still needs the account owner.**

The question: now that the Tauri PoC has shown the app runs from
`http://tauri.localhost` rather than a custom scheme, can the existing Firebase
popup flow be reused on desktop — avoiding a separate OAuth implementation?

**Answer: yes.** An isolated experiment (since removed) drove `signInWithPopup`
from `http://tauri.localhost` and reached Google's real sign-in page; the
production shell now does the same. See
[Experiment results](#experiment-results) and
[Production implementation](#production-implementation). The earlier pessimistic
reading in the *Options* section below is superseded and kept for context.

> **First pass got this wrong.** The initial analysis leaned toward Option B on
> the basis that popup reuse faced three risky gates. Two of those turned out to
> be non-issues on inspection and the third failed to reproduce. The lesson is
> in the doc deliberately: the gates were reasoned about correctly, but their
> *likelihood* was guessed at, and guessing was unnecessary when each one was
> cheaply testable.

---

## Current architecture

| Piece | Value |
| --- | --- |
| `authDomain` | `practice-hub-00.firebaseapp.com` |
| Web sign-in | `signInWithPopup` + `GoogleAuthProvider` in `platform/auth/webAuth.js` |
| Native sign-in | the same module — `platform/auth/index.js` no longer branches |
| Tauri origin | `http://tauri.localhost` |
| Shell | window built in `lib.rs` with an `on_new_window` allow-list; log plugin |
| Versions | tauri 2.11.5, tauri-runtime-wry 2.11.4, wry 0.55.1 |

Before this work the native branch threw `AuthNotImplementedError`; that stub is
gone, because the tested path needs no native-specific implementation.

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

**3. `window.open()` is suppressed in the *current* shell — by omission, not by
policy.** The cause is in wry, not Firebase. From
`wry-0.55.1/src/webview2/mod.rs`, the `NewWindowRequested` handler:

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

Tauri exposes the hook, so this is an obstacle rather than a wall — and the
experiment below confirms that registering it resolves the problem completely.

**4. No custom user agent is set.** Both wry and `tauri-runtime-wry` only apply
one when explicitly configured (`if let Some(user_agent)`), so WebView2 presents
its stock Chromium/Edge UA. This turned out to matter for gate 3.

**5. The native auth boundary behaved as designed while it existed.**
Unit-tested against the real selection logic in `platform/auth/index.js` with
`isNative` stubbed both ways: web delegated to `webAuth`; native threw
`AuthNotImplementedError`, named the file to edit, and never silently fell back
(10/10). Superseded — see [Production implementation](#production-implementation).

**6. `tauri.localhost` is already an authorised domain — no Console change
needed.** The project's authorised list (read via the public
`identitytoolkit.googleapis.com/v1/projects` endpoint) is:

```text
localhost
practice-hub-00.firebaseapp.com
practice-hub-00.web.app
subtlemocha00.github.io
guitar-bass-hub.vercel.app
guitar-bass-hub-git-main-subtle-projects.vercel.app
guitar-bass-evf6styai-subtle-projects.vercel.app
```

`tauri.localhost` is not listed — but it does not need to be. From
`@firebase/auth`'s `matchDomain`:

```js
const escapedDomainPattern = expected.replace(/\./g, '\\.');
const re = new RegExp('^(.+\\.' + escapedDomainPattern + '|' + escapedDomainPattern + ')$', 'i');
return re.test(hostname);
```

The entry `localhost` compiles to `^(.+\.localhost|localhost)$`, which matches
`tauri.localhost` as a subdomain. The protocol guard is `HTTP_REGEX = /^https?/`,
which `http:` satisfies.

Note the corollary: `tauri://localhost` — the custom scheme earlier audits
assumed — would have been **rejected** by that same protocol guard. The origin
Tauri actually uses is the reason this works at all.

---

## Experiment results

An isolated experiment was built on a throwaway branch, run, and then removed
entirely. It never touched the production auth boundary: it used a hand-written
test page and a temporary Rust shell that created its window with
`on_new_window` attached. **All experiment changes have been reverted and the
branch deleted.**

| Gate | Result | Evidence |
| --- | --- | --- |
| 1. `window.open()` reaches Tauri | **PASS** | `on_new_window` fired; JS received a non-null window |
| 2. Origin is authorised | **PASS** | no `auth/unauthorized-domain`; popup opened with `redirectUrl=http%3A%2F%2Ftauri.localhost%2F` |
| 3. Google accepts WebView2 | **PASS** | real Google sign-in page rendered, no `disallowed_useragent` |
| 4. Sign-in completes, session persists | **not tested** | requires the account owner's credentials |

Details worth keeping:

- **Popup blocking is a non-issue.** `window.open()` succeeded *even without
  user activation* once `on_new_window` returned `Allow` — Chromium's popup
  blocker never came into play.
- **The user agent is a stock desktop Edge string:**
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like
  Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0`. No `wv` marker, nothing
  identifying Tauri. That is very likely why gate 3 passed.
- **The popup is a real WebView2 browser window** owned by `msedgewebview2.exe`,
  516×672, **with a visible address bar** showing
  `https://accounts.google.com/v3/signin/identifier`. That matters: Google's
  embedded-webview policy exists so users can verify the URL they are typing
  credentials into, and this popup satisfies that.
- The page rendered "Sign in with Google — to continue to
  **practice-hub-00.firebaseapp.com**" with an email field, i.e. the normal
  consent flow, not a block page.

### Reproducing it

Two temporary changes, roughly ten minutes including the Rust rebuild:

1. In `src-tauri/src/lib.rs`, build the window in Rust so the hook can attach:

   ```rust
   WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
     .on_new_window(|url, _| {
       println!("[EXPERIMENT] on_new_window -> {url}");
       NewWindowResponse::Allow
     })
     .build()?;
   ```

2. Point `frontendDist` at a test page and clear `app.windows` so the config
   does not also create one. Remove `devUrl`, or a debug build will try to load
   the dev server instead of the local page.

### What is still unproven

Completing the sign-in needs the account owner to enter Google credentials, so
these remain untested:

- Does Firebase return a valid user and a working session?
- Does `postMessage` deliver the credential back to `http://tauri.localhost`?
- Does the session survive an app restart?

The last one is *likely* — the WebView2 profile persists across runs (verified
during the PoC by wiping it and watching it rebuild) and Firebase Auth persists
to IndexedDB there (`firebaseLocalStorageDb`, also verified). But that is
inference from two proven facts, **not a tested result.**

---

## Production implementation

Two changes, one per side of the boundary.

### 1. The shell allows exactly one popup URL

`src-tauri/src/lib.rs` now builds the main window itself so `on_new_window` can
be attached, and answers new-window requests with an allow-list:

```rust
fn is_firebase_auth_handler(url: &Url) -> bool {
  url.scheme() == "https"
    && url.path() == "/__/auth/handler"
    && url.host_str().is_some_and(|h| h.ends_with(".firebaseapp.com"))
}
```

Allowed → `NewWindowResponse::Allow`. Everything else → `Deny`, with a
`log::warn!`, because a silent denial is otherwise undiagnosable: nothing
happens and no error reaches the page.

**Why an allow-list and not a bridge.** Returning `Allow` unconditionally would
be simpler and is what the experiment did — but it would hand any content the
app renders, YouTube embeds most obviously, an in-app browser window that the
user cannot navigate or inspect beyond the OS chrome. The auth handler is the
only URL the app has a reason to open this way. External links are meant to
reach the *system* browser through `platform/links.js`, which is a separate
(and still unimplemented) native concern.

**Why the host test is structural.** The real `authDomain` is build-time
configuration (`VITE_FIREBASE_AUTH_DOMAIN`, gitignored) that Rust never sees, so
the rule matches the shape of a Firebase auth handler rather than one hardcoded
domain. A custom `authDomain` would need the host test widened. The suffix test
includes the leading dot, so `evil-firebaseapp.com` does not match.

Covered by `cargo test --lib` (2 tests): the handler URL is allowed;
`about:blank`, plain external links, right-host-wrong-path,
right-path-wrong-host and an `http:` downgrade are all denied.

Note the window is still *declared* in `tauri.conf.json` — it gained
`"create": false` and is built from that same config via
`WebviewWindowBuilder::from_config`. Size and title stay configuration; only the
handler lives in Rust.

### 2. The auth boundary stopped branching

`platform/auth/index.js` exports `webAuth.signIn` / `webAuth.signOut` directly.
There is no native branch, because there is no native implementation to select —
adding one that re-exported `webAuth` would be indirection with nothing behind
it. `isNative` is no longer imported there.

The boundary itself is unchanged and still earns its place: if Google's policy
tightens, or Capacitor arrives with its custom scheme, a sibling module selected
by `platform()` replaces this one and nothing else in the app moves.

**One consequence to be aware of:** the loud native failure is gone. If a
Capacitor target is added later it will inherit the popup path, which is
expected to fail on `capacitor://localhost`. Adding a mobile build target must
reintroduce the branch — noted in the roadmap.

### Verified in the production build

Launched `src-tauri/target/release/app.exe`, clicked SIGN IN by synthetic input,
and enumerated new top-level windows:

```text
[0] pid=16520 (msedgewebview2) 'Sign in - Google Accounts' 516x672
```

Captured: Google's real sign-in page, address bar showing
`https://accounts.google.com/v3/signin/identifier`, body reading "Sign in with
Google — to continue to practice-hub-00.firebaseapp.com". No
`auth/unauthorized-domain`, no `auth/popup-blocked`, no `disallowed_useragent`.

That is gates 1–3 reproduced outside the experiment, in the shipped shell,
through the real UI.

### Still requires the account owner

Everything past the credential prompt. Entering a Google password is not
something this validation could do:

1. Sign-in completes and the user appears in the app header.
2. The session survives closing and reopening the app.
3. Sign-out works.

Steps 1 and 2 are the substance of gate 4. Until they are done, "desktop sign-in
works" is proven up to the point where Google takes over and inferred after it.

---

## Tested behaviour

| Check | Result | How |
| --- | --- | --- |
| Origin is `http://tauri.localhost` | confirmed | profile wipe + relaunch |
| Firebase SDK initialises | confirmed | IndexedDB + `__sak` recreated |
| App renders, storage hydrates, auth state resolves | confirmed | window capture (see [tauri-poc.md](tauri-poc.md)) |
| SIGN IN opens Google's sign-in page | confirmed | production build, window capture |
| Popup allow-list allows the handler, denies the rest | confirmed | `cargo test --lib` |
| Sign-in completes / persists / signs out | **not tested** | needs the account owner |

---

## Options

### Option A — reuse `signInWithPopup` from `http://tauri.localhost`

All three gates **tested and passing** (see
[Experiment results](#experiment-results)):

1. `window.open` → passes once `on_new_window` returns `Allow`. Roughly eight
   lines of Rust; no JS change.
2. `tauri.localhost` authorised → passes already, via subdomain matching on the
   existing `localhost` entry. **No Console change.**
3. Google accepts WebView2 → passes; the real sign-in page rendered.

| | |
| --- | --- |
| Complexity | **Lowest.** A Rust handler, and `platform/auth` selecting `webAuth` on native. No new dependency, no OAuth client, no loopback server |
| Reliability | Good *today*. Residual risk is that gate 3 is Google policy, not a contract — it could tighten later |
| Maintenance | Minimal code. One external assumption to keep an eye on |
| Fits abstraction | Perfectly — native reuses `webAuth` unchanged |

The residual risk is real but smaller than first assumed: the popup is a
genuine WebView2 window **with a visible address bar**, which is the property
Google's embedded-webview policy exists to protect. This is not a webview
pretending to be a browser.

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

**Option A was chosen and is implemented.** It is dramatically cheaper than
Option B — no OAuth client registration, no loopback listener, no PKCE, no
Console changes — and it reuses `webAuth` verbatim behind the existing boundary.

Two honest caveats remain:

1. **The final step is still unproven.** Sign-in has been driven up to Google's
   credential prompt in the production build, not through it. Someone with the
   account should complete one sign-in and confirm the session survives a
   restart.
2. **Gate 3 is a policy, not a contract.** Google could tighten
   embedded-webview detection later. The mitigation is that the abstraction
   already isolates this: if Option A ever breaks, adding a `desktopAuth.js`
   implementing Option B and selecting it in `platform/auth/index.js` is a
   one-file change, and `AuthProvider` and every consumer stay untouched. That is
   precisely the insurance the platform layer was built to provide.

Option B remains the documented fallback and does not need building now.

### Implementation plan — status

1. ~~Add the `on_new_window` handler to the production shell, scoped to the
   Firebase auth handler.~~ **Done** — see
   [Production implementation](#production-implementation).
2. ~~Point native at `webAuth` instead of the `notImplemented` stub.~~ **Done**;
   the branch was removed rather than repointed.
3. **Have the account owner complete one sign-in and confirm persistence across
   a restart.** Outstanding — the only remaining unknown.
4. Verify sign-out, token refresh, and the offline case (a returning user with
   no network — Firestore has a persistent cache, auth does not).
5. Reintroduce a native branch when a Capacitor target is added;
   `capacitor://localhost` would fail the same `HTTP_REGEX` guard that
   `tauri://localhost` fails, so mobile cannot inherit this path untested.

## Unresolved questions

Answered by the experiment and the implementation:

- ~~Does Firebase accept `tauri.localhost`?~~ Yes, already, via subdomain
  matching on `localhost`. No Console change.
- ~~Does Google reject WebView2?~~ No. The sign-in page rendered normally.
- ~~Does `on_new_window` make `window.open` work?~~ Yes.
- ~~Does it still work in the real app rather than a test page?~~ Yes —
  clicking SIGN IN in the release build opens Google's sign-in page.

Still open:

1. Does sign-in complete and return a valid user? Needs the account owner.
2. Does the session survive an app restart? Likely (WebView2 profile and
   Firebase IndexedDB persistence are both verified) but untested.
3. How should sign-in behave offline? Firestore has a persistent cache, auth
   does not — a returning user with no network currently sees a signed-out app.
4. Capacitor is unexamined. `capacitor://localhost` would fail the same
   `HTTP_REGEX` protocol guard, so mobile likely needs Option B regardless of
   what desktop chooses — unless `iosScheme: 'https'` changes that.
