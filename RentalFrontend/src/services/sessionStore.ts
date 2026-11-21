import type { AuthUser } from "../context/auth";
import { tokenHasRole } from "./auth";

const KEY = "rental.session";

// Only these are stored. isAdmin is re-derived from the token on load, never trusted from storage.
interface StoredSession {
    email : string;
    accessToken : string;
    expiresAt : number;
}

// Keeps the signed-in session in sessionStorage so a page reload doesn't sign the user out.
// Every access is guarded: storage can be blocked or full, and the app must still work without it.
export function saveSession(user: AuthUser): void {
    const session: StoredSession = { email: user.email, accessToken: user.accessToken, expiresAt: user.expiresAt };
    try {
        sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
        // Not persisted; the session still works in memory
    }
}

// Returns the stored session, or null (clearing it) if it is missing, malformed or expired
export function loadSession(): AuthUser | null {
    try {
        const raw = sessionStorage.getItem(KEY);
        if (raw === null) {
            return null;
        }
        const stored = JSON.parse(raw) as Partial<StoredSession> | null;
        if (
            typeof stored?.email !== "string" ||
            typeof stored.accessToken !== "string" ||
            typeof stored.expiresAt !== "number" ||
            !Number.isFinite(stored.expiresAt) ||
            stored.expiresAt <= Date.now()
        ) {
            clearSession();
            return null;
        }
        return {
            email: stored.email,
            accessToken: stored.accessToken,
            expiresAt: stored.expiresAt,
            isAdmin: tokenHasRole(stored.accessToken, "Admin"),
        };
    } catch {
        clearSession();
        return null;
    }
}

export function clearSession(): void {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        // Nothing to clear if storage is unavailable
    }
}
