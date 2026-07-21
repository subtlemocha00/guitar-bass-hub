import { readFileSync } from 'node:fs'
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
  const isNative = mode === 'native'
  const target = isNative ? 'native' : 'web'

  // Unchanged for web: correct base depending on where it's deployed.
  const base = isNative ? './' : process.env.VERCEL ? '/' : '/guitar-bass-hub/'

  return {
    base,
    // Separate output directories so the two targets never overwrite each
    // other. Without this, running the native build before `npm run deploy`
    // would publish a service-worker-less build to the web.
    build: {
      outDir: isNative ? 'dist-native' : 'dist',
    },
    // Exposed so app code can branch at runtime without re-deriving the target
    // (the future openExternal / platform seams need this).
    define: {
      'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(target),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    },
    plugins: [
      react(),
      // Spread so the native build contains no PWA plugin at all.
      ...(isNative
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
