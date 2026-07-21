import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './features/auth/AuthProvider.jsx'
import { hydrateStorage } from './platform/storage'
import './index.css'

// Hydrate persisted storage before the first render, so features can keep
// reading it synchronously in useState initialisers. This is the whole reason
// no loading gate or provider is needed: nothing renders until the cache is
// populated, so defaults can never appear and then be replaced.
//
// On web this costs a microtask (localStorage is synchronous underneath). On a
// future native driver it costs a real read, which is exactly when blocking
// first paint is worth it — the alternative is a visible flash of defaults.
//
// hydrateStorage() never rejects; if storage is unreadable the app renders on
// defaults rather than not rendering at all.
hydrateStorage().then(() => {
	ReactDOM.createRoot(document.getElementById('root')).render(
		<React.StrictMode>
			<AuthProvider>
				<App />
			</AuthProvider>
		</React.StrictMode>,
	)
})
