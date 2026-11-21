import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../test/mockFetch";
import { signInWithGoogle, tokenHasRole } from "./auth";

// A token with the given claims; the signature is irrelevant because the client never verifies it
function tokenWith(claims: Record<string, unknown>): string {
    const payload = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `header.${payload}.signature`;
}

describe("tokenHasRole", () => {
    it("reads a string role claim", () => {
        expect(tokenHasRole(tokenWith({ role: "Admin" }), "Admin")).toBe(true);
    });

    it("reads an array role claim", () => {
        expect(tokenHasRole(tokenWith({ role: ["User", "Admin"] }), "Admin")).toBe(true);
    });

    it("reads the Microsoft role claim URI", () => {
        const uri = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
        expect(tokenHasRole(tokenWith({ [uri]: "Admin" }), "Admin")).toBe(true);
    });

    it("is false for a different role or no role", () => {
        expect(tokenHasRole(tokenWith({ role: "User" }), "Admin")).toBe(false);
        expect(tokenHasRole(tokenWith({}), "Admin")).toBe(false);
    });

    it("handles base64url payloads that need - and _ translated", () => {
        // "?>?" style bytes produce + and / in plain base64
        expect(tokenHasRole(tokenWith({ role: "Admin", note: "???>>>" }), "Admin")).toBe(true);
    });

    it.each(["", "not-a-token", "a.b.c", "a.!!!.c"])("is false for garbage %j", value => {
        expect(tokenHasRole(value, "Admin")).toBe(false);
    });
});

describe("signInWithGoogle", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("posts the id token and returns the login response", async () => {
        const fetchMock = mockFetch(200, { email: "a@b.co", accessToken: "tok", expiresIn: 3600 });

        await expect(signInWithGoogle("google-id-token")).resolves.toEqual({ email: "a@b.co", accessToken: "tok", expiresIn: 3600 });

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("/api/auth/google");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual({ idToken: "google-id-token" });
    });

    it("explains a 401 as a Google problem", async () => {
        mockFetch(401);
        await expect(signInWithGoogle("x")).rejects.toThrow("Google sign-in didn't work");
    });

    it("gives a generic message for other failures", async () => {
        mockFetch(500);
        await expect(signInWithGoogle("x")).rejects.toThrow("couldn't sign you in");
    });
});
