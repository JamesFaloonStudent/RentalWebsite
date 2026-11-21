import { useEffect, useState, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "./auth";
import { signInWithGoogle, tokenHasRole } from "../services/auth";
import { clearSession, loadSession, saveSession } from "../services/sessionStore";

// The session is kept in sessionStorage (never localStorage) so a page reload doesn't sign the user out.
// It is restored synchronously on first render, so pages never see a signed-out user for a moment.
export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(loadSession);

    useEffect(() => {
        if (!user) {
            return;
        }
        const timeout = setTimeout(() => {
            clearSession();
            setUser(null);
        }, Math.max(0, user.expiresAt - Date.now()));
        return () => clearTimeout(timeout);
    }, [user]);

    async function signIn(googleIdToken: string) {
        const response = await signInWithGoogle(googleIdToken);
        const signedIn: AuthUser = {
            email: response.email,
            accessToken: response.accessToken,
            expiresAt: Date.now() + response.expiresIn * 1000,
            isAdmin: tokenHasRole(response.accessToken, "Admin"),
        };
        saveSession(signedIn);
        setUser(signedIn);
    }

    function signOut() {
        clearSession();
        setUser(null);
    }

    return <AuthContext value={{ user, signIn, signOut }}>{children}</AuthContext>;
}
