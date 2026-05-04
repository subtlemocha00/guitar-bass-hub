import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../../firebase/firebase";

export function useAuth() {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			if (currentUser) {
				setUser(currentUser);
				setLoading(false);
				console.log("[auth] signed in as", currentUser.uid);
				return;
			}

			signInAnonymously(auth).catch((err) => {
				console.error("[auth] anonymous sign-in failed:", err);
				setLoading(false);
			});
		});

		return unsubscribe;
	}, []);

	return { user, loading };
}
