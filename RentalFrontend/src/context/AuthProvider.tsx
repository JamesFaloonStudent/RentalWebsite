import { useEffect, useState, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "./auth";
import { login, tokenHasRole } from "../services/auth";

// The access token lives in memory only (never localStorage), so a page refresh signs the user out
export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        if (!user) {
            return;
        }
        const timeout = setTimeout(() => setUser(null), Math.max(0, user.expiresAt - Date.now()));
        return () => clearTimeout(timeout);
    }, [user]);

    async function signIn(email: string, password: string) {
        const response = await login(email, password);
        setUser({
            email: response.email,
            accessToken: response.accessToken,
            expiresAt: Date.now() + response.expiresIn * 1000,
            isAdmin: tokenHasRole(response.accessToken, "Admin"),
        });
    }

    function signOut() {
        setUser(null);
    }

    return <AuthContext value={{ user, signIn, signOut }}>{children}</AuthContext>;
}
