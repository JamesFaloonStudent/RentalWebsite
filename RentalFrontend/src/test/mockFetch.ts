import { vi } from "vitest";

// Replaces global fetch with one canned response; returns the mock so tests can inspect calls
export function mockFetch(status: number, body?: unknown) {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(
        body === undefined ? null : JSON.stringify(body),
        { status, headers: { "Content-Type": "application/json" } },
    )));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}
