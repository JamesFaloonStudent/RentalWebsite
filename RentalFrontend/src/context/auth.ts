import { createContext, useContext } from "react";

export interface AuthUser {
    email : string;
    accessToken : string;
    expiresAt : number;
    isAdmin : boolean;
}

export interface AuthState {
    user : AuthUser | null;
    signIn : (email: string, password: string) => Promise<void>;
    signOut : () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
    const auth = useContext(AuthContext);
    if (!auth) {
        throw new Error("useAuth must be used inside <AuthProvider>");
    }
    return auth;
}
