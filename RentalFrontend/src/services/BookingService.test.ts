import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../test/mockFetch";
import { getMyRentals, noteFor, statusAndTab, toRental, type ApiBooking } from "./BookingService";

afterEach(() => vi.unstubAllGlobals());

// "Now" is Thu 15 Oct 2026, 12:00 local (the test run's timezone is pinned to UTC)
const now = new Date(2026, 9, 15, 12, 0);
const inFuture = new Date(2026, 9, 15, 12, 30).toISOString();
const inPast = new Date(2026, 9, 15, 11, 30).toISOString();

function booking(overrides: Partial<ApiBooking> = {}): ApiBooking {
    return {
        bookingId: "abcd1234-0000-0000-0000-000000000000",
        rentalId: "r1",
        rentalName: "Sea Ray SPX 190",
        category: "Boat",
        startDate: "2026-10-20",
        endDate: "2026-10-22",
        days: 2,
        unitPriceCents: 34900,
        totalAmountCents: 69800,
        currency: "cad",
        status: "Confirmed",
        expiresAt: inFuture,
        createdAt: inPast,
        payment: null,
        ...overrides,
    };
}

describe("statusAndTab", () => {
    it("treats an unpaid booking inside its hold as awaiting payment", () => {
        expect(statusAndTab(booking({ status: "PendingPayment", expiresAt: inFuture }), now)).toEqual({ status: "Awaiting payment", tab: "upcoming" });
    });

    it("treats an unpaid booking past its hold as expired", () => {
        expect(statusAndTab(booking({ status: "PendingPayment", expiresAt: inPast }), now)).toEqual({ status: "Expired", tab: "past" });
    });

    it("puts a confirmed future booking under upcoming", () => {
        expect(statusAndTab(booking(), now)).toEqual({ status: "Confirmed", tab: "upcoming" });
    });

    it("puts a confirmed booking starting today under active", () => {
        expect(statusAndTab(booking({ startDate: "2026-10-15", endDate: "2026-10-17" }), now)).toEqual({ status: "Out now", tab: "active" });
    });

    it("keeps a booking active on its last day", () => {
        expect(statusAndTab(booking({ startDate: "2026-10-13", endDate: "2026-10-15" }), now)).toEqual({ status: "Out now", tab: "active" });
    });

    it("puts a confirmed booking that ended yesterday under past as completed", () => {
        expect(statusAndTab(booking({ startDate: "2026-10-12", endDate: "2026-10-14" }), now)).toEqual({ status: "Completed", tab: "past" });
    });

    it.each([["Cancelled"], ["Refunded"], ["Expired"]] as const)("puts %s under past", status => {
        expect(statusAndTab(booking({ status }), now)).toEqual({ status, tab: "past" });
    });
});

describe("noteFor", () => {
    it("tells an active renter when to return", () => {
        expect(noteFor(booking({ endDate: "2026-10-17" }), "Out now")).toContain("Return by the end of");
    });

    it("mentions the refunded amount on a cancelled booking", () => {
        const refunded = booking({ status: "Cancelled", payment: { status: "Refunded", amountRefundedCents: 50000 } });
        expect(noteFor(refunded, "Cancelled")).toContain("$500 refunded");
    });

    it("has no note for a cancelled booking that was never paid", () => {
        expect(noteFor(booking({ status: "Cancelled" }), "Cancelled")).toBe("");
    });

    it("explains an expired booking", () => {
        expect(noteFor(booking(), "Expired")).toContain("released");
    });

    it("has no note for an ordinary confirmed booking", () => {
        expect(noteFor(booking(), "Confirmed")).toBe("");
    });
});

describe("toRental", () => {
    it("maps a booking to the display model", () => {
        const rental = toRental(booking(), now);

        expect(rental).toMatchObject({
            id: "abcd1234-0000-0000-0000-000000000000",
            listingId: "r1",
            category: "boats",
            name: "Sea Ray SPX 190",
            reference: "HH-ABCD-1234",
            tab: "upcoming",
            status: "Confirmed",
            total: "$698",
            breakdown: "$349 × 2 days",
        });
        expect(rental.dates).toContain("2 days");
        expect(rental.dates).toContain("Oct 20");
        expect(rental.dates).toContain("Oct 22");
    });

    it("falls back to a generic name when the rental has none", () => {
        expect(toRental(booking({ rentalName: null }), now).name).toBe("Rental");
    });

    it("shows cents in totals that have them", () => {
        expect(toRental(booking({ totalAmountCents: 69850 }), now).total).toBe("$698.50");
    });

    it("maps a trailer category", () => {
        expect(toRental(booking({ category: "Trailer" }), now).category).toBe("trailers");
    });
});

describe("getMyRentals", () => {
    it("returns an empty list without calling the API when signed out", async () => {
        const fetchMock = mockFetch(200, []);
        await expect(getMyRentals(null)).resolves.toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns an empty list when the user has no bookings", async () => {
        mockFetch(200, []);
        await expect(getMyRentals("tok")).resolves.toEqual([]);
    });

    it("maps the bookings the API returns", async () => {
        mockFetch(200, [booking()]);
        const rentals = await getMyRentals("tok");
        expect(rentals).toHaveLength(1);
        expect(rentals[0].name).toBe("Sea Ray SPX 190");
    });

    it("surfaces a failure instead of an empty list", async () => {
        mockFetch(404);
        await expect(getMyRentals("tok")).rejects.toThrow("couldn't load your rentals");
    });
});
