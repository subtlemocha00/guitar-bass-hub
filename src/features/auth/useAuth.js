import { useEffect, useState } from "react";
import {
	onAuthStateChanged,
	GoogleAuthProvider,
	signInWithPopup,
	signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../../firebase/firebase";

const provider = new GoogleAuthProvider();

export function useAuth() {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setLoading(false);
			if (currentUser) {
				console.log("[auth] session restored for", currentUser.uid);
			}
		});

		return unsubscribe;
	}, []);

	function signIn() {
		signInWithPopup(auth, provider).catch((err) => {
			if (err.code !== "auth/popup-closed-by-user") {
				console.error("[auth] sign-in error:", err);
			}
		});
	}

	function signOut() {
		firebaseSignOut(auth).catch((err) => {
			console.error("[auth] sign-out error:", err);
		});
	}

	return { user, loading, signIn, signOut };
}
