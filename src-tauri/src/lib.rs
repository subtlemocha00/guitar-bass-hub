use tauri::webview::{NewWindowFeatures, NewWindowResponse};
use tauri::{Url, WebviewWindowBuilder};

// Google sign-in runs through Firebase's popup flow, the same one the web build
// uses: signInWithPopup opens a second window at
// https://<authDomain>/__/auth/handler, which hands the credential back by
// postMessage. WebView2 refuses window.open unless the host answers the new
// window request, so without the handler below the desktop build cannot sign in
// at all — wry marks the request handled and creates nothing.
//
// WHY THIS IS AN ALLOW-LIST AND NOT A BRIDGE
// Allowing every window.open would give any content the app renders — YouTube
// embeds most obviously — an in-app browser window with no address bar,
// navigation or close affordance beyond the OS chrome. Only the Firebase auth
// handler is allowed; everything else is denied, and external links reach the
// system browser through platform/links instead.
//
// The match is structural rather than a hardcoded domain because the authDomain
// is build-time configuration (VITE_FIREBASE_AUTH_DOMAIN) that Rust never sees.
// A custom authDomain would need the host test widened.
fn is_firebase_auth_handler(url: &Url) -> bool {
  url.scheme() == "https"
    && url.path() == "/__/auth/handler"
    && url
      .host_str()
      .is_some_and(|host| host.ends_with(".firebaseapp.com"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();

  // Single instance must be registered before anything else so a second launch
  // is short-circuited before it starts building windows. Without it a second
  // process opens a second window against the *same* WebView2 profile, and the
  // two fight over the IndexedDB that holds the Firebase session.
  #[cfg(desktop)]
  let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.unminimize();
      let _ = window.set_focus();
    }
  }));

  #[cfg(desktop)]
  let builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());

  builder
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      // #[cfg] rather than `if cfg!(...)`: the runtime form leaves the logging
      // plugin compiled into the release binary for a branch that can never be
      // taken.
      #[cfg(debug_assertions)]
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;

      // The window stays declared in tauri.conf.json (create: false) so its
      // size and title remain configuration; it is built here only because
      // on_new_window can be attached to a builder and nothing else.
      let config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .expect("tauri.conf.json declares no window");

      WebviewWindowBuilder::from_config(app.handle(), &config)?
        .on_new_window(|url, _features: NewWindowFeatures| {
          if is_firebase_auth_handler(&url) {
            NewWindowResponse::Allow
          } else {
            // Denials are otherwise invisible: nothing happens and no error
            // reaches the page.
            log::warn!("[popup] denied window.open: {url}");
            NewWindowResponse::Deny
          }
        })
        .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::is_firebase_auth_handler;
  use tauri::Url;

  fn allows(url: &str) -> bool {
    is_firebase_auth_handler(&Url::parse(url).unwrap())
  }

  #[test]
  fn allows_the_firebase_auth_handler() {
    assert!(allows(
      "https://example.firebaseapp.com/__/auth/handler?apiKey=x&providerId=google.com"
    ));
  }

  #[test]
  fn denies_everything_else() {
    // Plain external links: these belong in the system browser.
    assert!(!allows("https://www.youtube.com/watch?v=x"));
    // Blank popups — the app never needs one, and it would be a window that
    // could then navigate anywhere.
    assert!(!allows("about:blank"));
    // Right host, wrong path.
    assert!(!allows("https://example.firebaseapp.com/"));
    // Right path, look-alike host that is not a firebaseapp.com subdomain.
    assert!(!allows("https://evil-firebaseapp.com/__/auth/handler"));
    assert!(!allows("https://firebaseapp.com.evil.test/__/auth/handler"));
    // Downgraded scheme.
    assert!(!allows("http://example.firebaseapp.com/__/auth/handler"));
  }
}
