import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../test/mockFetch";
import { apiRequest } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
    it("sends the bearer token with GET by default and returns the JSON", async () => {
        const fetchMock = mockFetch(200, [{ id: 1 }]);

        await expect(apiRequest("/api/things", "tok", "fallback")).resolves.toEqual([{ id: 1 }]);

        expect(fetchMock).toHaveBeenCalledWith("/api/things", { method: "GET", headers: { Authorization: "Bearer tok" } });
    });

    it("uses the method it is given", async () => {
        const fetchMock = mockFetch(200, {});
        await apiRequest("/api/things", "tok", "fallback", "POST");
        expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe("POST");
    });

    it("explains an expired session on 401", async () => {
        mockFetch(401);
        await expect(apiRequest("/x", "tok", "fallback")).rejects.toThrow("session has expired");
    });

    it("surfaces the server's message for other errors", async () => {
        mockFetch(409, { message: "Those dates are taken." });
        await expect(apiRequest("/x", "tok", "fallback")).rejects.toThrow("Those dates are taken.");
    });

    it("falls back when the error has no usable body", async () => {
        mockFetch(404);
        await expect(apiRequest("/x", "tok", "We couldn't do that.")).rejects.toThrow("We couldn't do that.");
    });
});
