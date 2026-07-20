import { createContext } from "react";

/**
 * Holds { user, loading, signIn, signOut }.
 *
 * Lives in its own module so AuthProvider.jsx only exports a component (React
 * Fast Refresh requires that) and consumers can import the hook without
 * pulling in the provider.
 *
 * `undefined` is the "no provider above me" sentinel — useAuthContext throws on
 * it rather than silently handing back a permanently signed-out user.
 */
export const AuthContext = createContext(undefined);
