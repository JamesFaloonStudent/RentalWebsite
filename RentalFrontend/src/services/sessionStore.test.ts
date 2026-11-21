import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../context/auth";
import { clearSession, loadSession, saveSession } from "./sessionStore";

const KEY = "rental.session";

function tokenWith(claims: Record<string, unknown>): string {
    return `h.${btoa(JSON.stringify(claims))}.s`;
}

function user(overrides: Partial<AuthUser> = {}): AuthUser {
    return { email: "a@b.co", accessToken: tokenWith({ role: "User" }), expiresAt: Date.now() + 60_000, isAdmin: false, ...overrides };
}

describe("sessionStore", () => {
    it("restores a saved session", () => {
        const saved = user();
        saveSession(saved);
        expect(loadSession()).toEqual(saved);
    });

    it("stores only the email, token and expiry", () => {
        saveSession(user({ isAdmin: true }));
        expect(Object.keys(JSON.parse(sessionStorage.getItem(KEY)!) as object).sort()).toEqual(["accessToken", "email", "expiresAt"]);
    });

    it("derives isAdmin from the token, not from what was stored", () => {
        saveSession(user({ accessToken: tokenWith({ role: "Admin" }), isAdmin: false }));
        expect(loadSession()?.isAdmin).toBe(true);

        sessionStorage.setItem(KEY, JSON.stringify({ email: "a@b.co", accessToken: tokenWith({ role: "User" }), expiresAt: Date.now() + 60_000, isAdmin: true }));
        expect(loadSession()?.isAdmin).toBe(false);
    });

    it("returns null when nothing is stored", () => {
        expect(loadSession()).toBeNull();
    });

    it("discards and clears an expired session", () => {
        saveSession(user({ expiresAt: Date.now() - 1 }));
        expect(loadSession()).toBeNull();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it.each([
        ["not json", "{oops"],
        ["null", "null"],
        ["missing fields", JSON.stringify({ email: "a@b.co" })],
        ["wrong types", JSON.stringify({ email: 1, accessToken: "t", expiresAt: Date.now() + 60_000 })],
        ["string expiry", JSON.stringify({ email: "a", accessToken: "t", expiresAt: "9999999999999" })],
    ])("ignores and clears a corrupt value (%s)", (_name, raw) => {
        sessionStorage.setItem(KEY, raw);
        expect(loadSession()).toBeNull();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it("clearSession removes the session", () => {
        saveSession(user());
        clearSession();
        expect(loadSession()).toBeNull();
    });

    it("doesn't throw when storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });

        expect(() => saveSession(user())).not.toThrow();
        expect(loadSession()).toBeNull();
        expect(() => clearSession()).not.toThrow();
    });
});
