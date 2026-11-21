import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../test/mockFetch";
import { cancelBooking, cancelPendingBooking, createCheckout, getCancelQuote } from "./StripeService";

afterEach(() => vi.unstubAllGlobals());

function lastCall(fetchMock: ReturnType<typeof mockFetch>): [string, RequestInit] {
    return fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

describe("createCheckout", () => {
    it("sends only the rental and dates, with the bearer token", async () => {
        const fetchMock = mockFetch(200, { bookingId: "b1", url: "https://pay.example.test" });

        await expect(createCheckout("r1", "2026-12-01", "2026-12-03", "tok")).resolves.toEqual({ bookingId: "b1", url: "https://pay.example.test" });

        const [url, init] = lastCall(fetchMock);
        expect(url).toBe("/api/stripe/checkout");
        expect(init.method).toBe("POST");
        expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
        expect(JSON.parse(init.body as string)).toEqual({ rentalId: "r1", startDate: "2026-12-01", endDate: "2026-12-03" });
    });

    it("explains an expired session on 401", async () => {
        mockFetch(401);
        await expect(createCheckout("r1", "a", "b", "tok")).rejects.toThrow("session has expired");
    });

    it("shows the server's message on a conflict", async () => {
        mockFetch(409, { message: "Those dates are taken." });
        await expect(createCheckout("r1", "a", "b", "tok")).rejects.toThrow("Those dates are taken.");
    });

    it("falls back to a generic message", async () => {
        mockFetch(500);
        await expect(createCheckout("r1", "a", "b", "tok")).rejects.toThrow("couldn't start your payment");
    });
});

describe("cancellation calls", () => {
    it("asks for the quote with GET", async () => {
        const fetchMock = mockFetch(200, { bookingId: "b1" });
        await getCancelQuote("b1", "tok");
        const [url, init] = lastCall(fetchMock);
        expect(url).toBe("/api/stripe/bookings/b1/cancel-quote");
        expect(init.method).toBe("GET");
    });

    it("cancels a paid booking with POST", async () => {
        const fetchMock = mockFetch(200, { bookingId: "b1", status: "Cancelled", feeCents: 0, refundCents: 100 });
        await expect(cancelBooking("b1", "tok")).resolves.toMatchObject({ status: "Cancelled" });
        const [url, init] = lastCall(fetchMock);
        expect(url).toBe("/api/stripe/bookings/b1/cancel");
        expect(init.method).toBe("POST");
    });

    it("abandons an unpaid booking with POST to cancel-pending", async () => {
        const fetchMock = mockFetch(200, { bookingId: "b1", status: "Cancelled", feeCents: 0, refundCents: 0 });
        await cancelPendingBooking("b1", "tok");
        expect(lastCall(fetchMock)[0]).toBe("/api/stripe/bookings/b1/cancel-pending");
    });

    it("encodes the booking id so it can't alter the path", async () => {
        const fetchMock = mockFetch(200, {});
        await getCancelQuote("a/b?c", "tok");
        expect(lastCall(fetchMock)[0]).toBe("/api/stripe/bookings/a%2Fb%3Fc/cancel-quote");
    });
});
