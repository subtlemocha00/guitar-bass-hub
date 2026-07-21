import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// App + Auth only. Firestore lives in ./db so that importing auth does not drag
// the Firestore SDK into the entry chunk.
//
// AuthProvider mounts at boot and gates first paint on onAuthStateChanged, so
// everything this module imports is unavoidably eager. Firestore is roughly a
// third of the initial bundle and is only needed once a data-bound route is
// opened, so it must not be reachable from here.

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
