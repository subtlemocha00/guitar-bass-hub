import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import { platformSignIn, platformSignOut } from "../../platform/auth";
import { AuthContext } from "./AuthContext";

/**
 * Owns the single onAuthStateChanged subscription for the whole app.
 *
 * Previously every consumer registered its own listener and kept its own copy
 * of the user — with one hook call per song card that meant dozens of listeners
 * and dozens of independent loading->loaded transitions. One listener here
 * means every consumer sees the same value at the same time.
 *
 * How a credential is obtained is *not* decided here: signIn/signOut delegate
 * to src/platform/auth, which picks the implementation for the build target.
 * The session listener below stays put because it is identical on every
 * platform — popup, native Google Sign-In and desktop OAuth all end in the
 * same Firebase session.
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

	// Stable identity while the user is unchanged, so consumers whose effects
	// depend on the context value don't re-run on unrelated re-renders. The two
	// handlers are module-level functions, so they need no useCallback — they
	// are already stable for the lifetime of the app.
	const value = useMemo(
		() => ({
			user,
			loading,
			signIn: platformSignIn,
			signOut: platformSignOut,
		}),
		[user, loading]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
