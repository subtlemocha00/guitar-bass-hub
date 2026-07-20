import { useCallback, useEffect, useMemo, useState } from "react";
import {
	onAuthStateChanged,
	GoogleAuthProvider,
	signInWithPopup,
	signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../../firebase/firebase";
import { AuthContext } from "./AuthContext";

const provider = new GoogleAuthProvider();

/**
 * Owns the single onAuthStateChanged subscription for the whole app.
 *
 * Previously every consumer registered its own listener and kept its own copy
 * of the user — with one hook call per song card that meant dozens of listeners
 * and dozens of independent loading->loaded transitions. One listener here
 * means every consumer sees the same value at the same time.
 */
export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		return onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setLoading(false);
		});
	}, []);

	const signIn = useCallback(() => {
		signInWithPopup(auth, provider).catch((err) => {
			if (err.code !== "auth/popup-closed-by-user") {
				console.error("[auth] sign-in error:", err);
			}
		});
	}, []);

	const signOut = useCallback(() => {
		firebaseSignOut(auth).catch((err) => {
			console.error("[auth] sign-out error:", err);
		});
	}, []);

	// Stable identity while the user is unchanged, so consumers whose effects
	// depend on the context value don't re-run on unrelated re-renders.
	const value = useMemo(
		() => ({ user, loading, signIn, signOut }),
		[user, loading, signIn, signOut]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
