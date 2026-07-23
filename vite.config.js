import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// One version for every target. src-tauri/tauri.conf.json reads this same file
// ("version": "../package.json"), so the desktop binary, the installer and the
// in-app readout can never disagree.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Build targets
// -------------
// Selected with Vite's --mode flag:
//
//   vite build                  -> target "web"    (mode "production")
//   vite build --mode native    -> target "native"
//
// Only two things actually differ, so this stays a single config that branches
// rather than two configs that drift apart.
//
//   base  web    "/" on Vercel, else "/guitar-bass-hub/" for the project page
//         native "./" so assets resolve from a file:// or custom-scheme origin,
//                which is what a Tauri/Capacitor shell serves from
//
//   PWA   web    enabled exactly as before
//         native omitted entirely, which also removes the service-worker
//                registration injected by injectRegister: 'auto'. A service
//                worker is unsupported on iOS WKWebView custom schemes and
//                fights the native asset loader elsewhere, and can pin users to
//                a stale build. PWA support is not removed — native just
//                bypasses it.
//
// A custom mode is safe here: `vite build` resolves NODE_ENV to production
// regardless of mode, so `--mode native` keeps production semantics
// (import.meta.env.PROD stays true, React builds in production mode). Verified
// against Vite's resolved config rather than assumed.
//
// Routing already suits native: HashRouter keeps routes in the URL fragment, so
// no server rewrites and no deep-link 404s from a filesystem origin.
export default defineConfig(({ mode }) => {
  // Three isolated build targets, selected by Vite's --mode:
  //   (default)  -> "web"        PWA, deployed base, dist/
  //   native     -> "native"     Tauri desktop shell, dist-native/   (legacy name)
  //   capacitor  -> "capacitor"  Capacitor mobile shell, dist-capacitor/
  //
  // The Tauri target keeps its historical mode name "native" so nothing about the
  // desktop build changes (its mode, output dir and tauri.conf.json frontendDist
  // all stay `native`/`dist-native`). The app layer tells the two packaged shells
  // apart via isTauri / isCapacitor — see src/platform/platform.js. This is
  // deliberately NOT a single generic "native" target: each shell selects its own
  // plugins at compile time so nothing leaks across targets.
  const isTauri = mode === 'native'
  const isCapacitor = mode === 'capacitor'
  const isPackaged = isTauri || isCapacitor
  const target = isCapacitor ? 'capacitor' : isTauri ? 'native' : 'web'

  // Packaged shells load assets relatively (a file:// or custom-scheme origin);
  // web keeps the base for wherever it's deployed.
  const base = isPackaged ? './' : process.env.VERCEL ? '/' : '/guitar-bass-hub/'

  // Build-time platform-implementation selection.
  //
  // These four boundaries each pull in a native plugin whose module calls
  // registerPlugin() at import time — a side effect a static import cannot be
  // tree-shaken past. So they CANNOT be selected with a source-level
  // `isCapacitor ? capacitorImpl : webImpl`: that would drag the plugin into the
  // web and Tauri bundles even with the branch folded to a constant. Aliasing
  // means only the selected file ever enters the module graph, so the plugin is
  // absent from the bundles that do not select it. This still keys on the Phase 1
  // build target — it is compile-time selection, just resolved by the bundler
  // instead of by dead-code elimination.
  //
  //   @auth-impl      credential acquisition   @capacitor-firebase/authentication
  //   @storage-impl   persistence driver       @capacitor/preferences
  //   @lifecycle-impl app-background flush      @capacitor/app
  //   @links-impl     leaving the app          @capacitor/browser (mobile) /
  //                                            @tauri-apps/plugin-opener (desktop)
  //   @nativeui-impl  status-bar theming        @capacitor/status-bar
  //
  // For the auth/storage/lifecycle/nativeui boundaries, web and Tauri share the
  // same web implementation (the desktop shell reuses the browser behaviour, and
  // there is no mobile status bar to theme) and only Capacitor swaps.
  //
  // @links-impl is the odd one out: three genuinely distinct implementations
  // (web window.open, Tauri opener, Capacitor Browser), so it is a three-way
  // select. It moved from a source-level `isTauri ? …` to an alias in Phase 4:
  // the Tauri opener is side-effect-free and tree-shook cleanly, but the new
  // Capacitor branch imports `@capacitor/browser`, whose registerPlugin() side
  // effect does not — so the whole boundary now takes the alias. The click-
  // interception decision in links/index.js stays an in-source `isWeb` branch,
  // because attaching an onClick handler pulls in no plugin.
  const authImpl = isCapacitor
    ? './src/platform/auth/mobileAuth.js'
    : './src/platform/auth/webAuth.js'
  const storageImpl = isCapacitor
    ? './src/platform/storage/capacitorStorage.js'
    : './src/platform/storage/webStorage.js'
  const lifecycleImpl = isCapacitor
    ? './src/platform/lifecycle/capacitorLifecycle.js'
    : './src/platform/lifecycle/webLifecycle.js'
  const linksImpl = isCapacitor
    ? './src/platform/links/capacitorLinks.js'
    : isTauri
      ? './src/platform/links/tauriLinks.js'
      : './src/platform/links/webLinks.js'
  const nativeUIImpl = isCapacitor
    ? './src/platform/nativeUI/capacitorNativeUI.js'
    : './src/platform/nativeUI/webNativeUI.js'

  return {
    base,
    resolve: {
      alias: {
        '@auth-impl': fileURLToPath(new URL(authImpl, import.meta.url)),
        '@storage-impl': fileURLToPath(new URL(storageImpl, import.meta.url)),
        '@lifecycle-impl': fileURLToPath(new URL(lifecycleImpl, import.meta.url)),
        '@links-impl': fileURLToPath(new URL(linksImpl, import.meta.url)),
        '@nativeui-impl': fileURLToPath(new URL(nativeUIImpl, import.meta.url)),
      },
    },
    // Separate output directories so the three targets never overwrite each
    // other. Without this, running a packaged build before `npm run deploy`
    // would publish a service-worker-less build to the web.
    build: {
      outDir: isCapacitor ? 'dist-capacitor' : isTauri ? 'dist-native' : 'dist',
    },
    // Exposed so app code can branch at runtime without re-deriving the target
    // (the future openExternal / platform seams need this).
    define: {
      'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(target),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    },
    plugins: [
      react(),
      // Spread so packaged builds (Tauri or Capacitor) contain no PWA plugin at all.
      ...(isPackaged
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              injectRegister: 'auto',
              includeAssets: [
                'favicon.png',
                'apple-touch-icon.png',
                'pwa-192x192.png',
                'pwa-512x512.png',
                'pwa-maskable-512x512.png',
              ],
              manifest: {
                name: 'Guitar+Bass//Hub',
                short_name: 'GB//Hub',
                description:
                  'Practice hub for guitar and bass: tuner, metronome, fretboard, scales, songs, and backing tracks.',
                start_url: '.',
                scope: '.',
                display: 'standalone',
                orientation: 'any',
                background_color: '#0a0c12',
                theme_color: '#0a0c12',
                icons: [
                  {
                    src: 'pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: 'pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: 'pwa-maskable-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2}'],
                navigateFallback: 'index.html',
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                // Never let the SW intercept Firebase/Firestore/Auth/Storage traffic.
                navigateFallbackDenylist: [
                  /^\/__\//,
                  /^\/api\//,
                  /firebaseio\.com/,
                  /firestore\.googleapis\.com/,
                  /identitytoolkit\.googleapis\.com/,
                  /securetoken\.googleapis\.com/,
                  /googleapis\.com/,
                  /gstatic\.com/,
                ],
                // Fonts are self-hosted, so they are picked up by globPatterns above
                // and precached with the rest of the app shell — no runtime rule and
                // no request to fonts.gstatic.com.
                runtimeCaching: [
                  {
                    urlPattern: ({ request }) => request.destination === 'image',
                    handler: 'StaleWhileRevalidate',
                    options: {
                      cacheName: 'images',
                      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
                    },
                  },
                  {
                    // Metronome WAV samples: cache on first play so the metronome keeps
                    // working offline. Audio is immutable, so CacheFirst is ideal.
                    urlPattern: ({ request, url }) =>
                      request.destination === 'audio' || url.pathname.endsWith('.wav'),
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'audio-samples',
                      expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                ],
              },
              devOptions: {
                enabled: false,
              },
            }),
          ]),
    ],
  }
})
