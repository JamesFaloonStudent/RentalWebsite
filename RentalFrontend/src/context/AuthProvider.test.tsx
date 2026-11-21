import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthProvider from "./AuthProvider";
import { useAuth, type AuthState } from "./auth";
import { saveSession } from "../services/sessionStore";

const signInWithGoogle = vi.hoisted(() => vi.fn());
vi.mock("../services/auth", async importOriginal => ({
    ...(await importOriginal<typeof import("../services/auth")>()),
    signInWithGoogle,
}));

const KEY = "rental.session";

function tokenWith(claims: Record<string, unknown>): string {
    return `h.${btoa(JSON.stringify(claims))}.s`;
}

// Exposes the latest auth state to the test and shows who is signed in
const captured: { auth?: AuthState } = {};
const currentAuth = () => captured.auth!;
function Probe() {
    const auth = useAuth();
    useEffect(() => { captured.auth = auth; });
    return <p>{auth.user ? `${auth.user.email} admin=${auth.user.isAdmin}` : "signed out"}</p>;
}

function renderProvider() {
    return render(<AuthProvider><Probe /></AuthProvider>);
}

describe("AuthProvider", () => {
    beforeEach(() => { signInWithGoogle.mockReset(); });
    afterEach(() => { vi.useRealTimers(); });

    it("starts signed out when nothing is stored", () => {
        renderProvider();
        expect(screen.getByText("signed out")).toBeInTheDocument();
    });

    it("restores a stored session on the very first render", () => {
        saveSession({ email: "a@b.co", accessToken: tokenWith({ role: "Admin" }), expiresAt: Date.now() + 60_000, isAdmin: false });

        renderProvider();

        expect(screen.getByText("a@b.co admin=true")).toBeInTheDocument();
    });

    it("does not restore an expired session", () => {
        saveSession({ email: "a@b.co", accessToken: "t", expiresAt: Date.now() - 1, isAdmin: false });

        renderProvider();

        expect(screen.getByText("signed out")).toBeInTheDocument();
    });

    it("signs in, exposes the user and saves the session", async () => {
        signInWithGoogle.mockResolvedValue({ email: "new@b.co", accessToken: tokenWith({ role: "User" }), expiresIn: 3600 });
        renderProvider();

        await act(() => currentAuth().signIn("google-id-token"));

        expect(signInWithGoogle).toHaveBeenCalledWith("google-id-token");
        expect(screen.getByText("new@b.co admin=false")).toBeInTheDocument();
        expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({ email: "new@b.co" });
    });

    it("stays signed out and saves nothing when sign-in fails", async () => {
        signInWithGoogle.mockImplementation(() => Promise.reject(new Error("nope")));
        renderProvider();

        // A failed sign-in changes no state, so this doesn't need act
        let failure: unknown;
        try {
            await currentAuth().signIn("bad");
        } catch (error) {
            failure = error;
        }

        expect(failure).toEqual(new Error("nope"));
        expect(screen.getByText("signed out")).toBeInTheDocument();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it("signs out and clears the stored session", () => {
        saveSession({ email: "a@b.co", accessToken: "t", expiresAt: Date.now() + 60_000, isAdmin: false });
        renderProvider();

        act(() => currentAuth().signOut());

        expect(screen.getByText("signed out")).toBeInTheDocument();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it("signs the user out when the token expires", () => {
        vi.useFakeTimers();
        saveSession({ email: "a@b.co", accessToken: "t", expiresAt: Date.now() + 1000, isAdmin: false });
        renderProvider();
        expect(screen.getByText(/a@b.co/)).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1001));

        expect(screen.getByText("signed out")).toBeInTheDocument();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });
});
