import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRemote } from "./useRemote";

// A promise the test settles by hand, to control response order
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe("useRemote", () => {
    it("starts loading, then returns the data", async () => {
        const load = vi.fn((id: string) => Promise.resolve(`data for ${id}`));

        const { result } = renderHook(() => useRemote(load, "a"));

        expect(result.current).toEqual({ data: undefined, error: undefined, loading: true });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current).toEqual({ data: "data for a", error: undefined, loading: false });
    });

    it("returns the error message when loading fails", async () => {
        const load = vi.fn(() => Promise.reject(new Error("nope")));

        const { result } = renderHook(() => useRemote(load, "a"));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current).toEqual({ data: undefined, error: "nope", loading: false });
    });

    it("reloads when the argument changes and never shows the old argument's data", async () => {
        const load = vi.fn((id: string) => Promise.resolve(`data for ${id}`));

        const { result, rerender } = renderHook(({ id }) => useRemote(load, id), { initialProps: { id: "a" } });
        await waitFor(() => expect(result.current.data).toBe("data for a"));

        rerender({ id: "b" });
        expect(result.current.loading).toBe(true);
        expect(result.current.data).toBeUndefined();
        await waitFor(() => expect(result.current.data).toBe("data for b"));
    });

    it("ignores a slow response for an argument that is no longer current", async () => {
        const slow = deferred<string>();
        const load = vi.fn((id: string) => id === "a" ? slow.promise : Promise.resolve("data for b"));

        const { result, rerender } = renderHook(({ id }) => useRemote(load, id), { initialProps: { id: "a" } });
        rerender({ id: "b" });
        await waitFor(() => expect(result.current.data).toBe("data for b"));

        slow.resolve("stale data for a");
        await Promise.resolve();

        expect(result.current.data).toBe("data for b");
    });
});
