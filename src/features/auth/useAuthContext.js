import { useContext } from "react";
import { AuthContext } from "./AuthContext";

/**
 * Read the shared auth state: { user, loading, signIn, signOut }.
 *
 * Same shape the old per-component useAuth() hook returned, so consumers only
 * had to change which module they import from.
 */
export function useAuthContext() {
	const value = useContext(AuthContext);
	if (value === undefined) {
		throw new Error("useAuthContext must be used inside an <AuthProvider>");
	}
	return value;
}
