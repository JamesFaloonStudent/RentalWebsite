import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../test/mockFetch";
import { deleteRental, getAllRentals, getRentalById, toCategory } from "./RentalService";

afterEach(() => vi.unstubAllGlobals());

const apiRental = { id: "r1", imageUrl: null, category: "Boat", name: null, type: null, description: null, pricePerDay: 120, location: null, visible: null, capacity: null, lengthFt: null, licence: null, included: null };

describe("toCategory", () => {
    it.each([["Trailer", "trailers"], ["trailers", "trailers"], ["Boat", "boats"], ["", "boats"], [null, "boats"]] as const)("maps %j to %s", (value, expected) => {
        expect(toCategory(value)).toBe(expected);
    });
});

describe("getAllRentals", () => {
    it("maps the API's nullable fields to safe defaults", async () => {
        mockFetch(200, [apiRental]);

        const [listing] = await getAllRentals();

        expect(listing).toMatchObject({ id: "r1", category: "boats", name: "", location: "", visible: false, included: [], pricePerDay: 120 });
    });

    it("throws a friendly error on failure", async () => {
        mockFetch(500);
        await expect(getAllRentals()).rejects.toThrow("couldn't load the rentals");
    });
});

describe("getRentalById", () => {
    it("resolves to null when the rental doesn't exist", async () => {
        mockFetch(404);
        await expect(getRentalById("missing")).resolves.toBeNull();
    });

    it("throws on other failures", async () => {
        mockFetch(500);
        await expect(getRentalById("r1")).rejects.toThrow("couldn't load that rental");
    });
});

describe("deleteRental", () => {
    it("explains that a listing with bookings can't be deleted", async () => {
        mockFetch(409);
        await expect(deleteRental("r1", "tok")).rejects.toThrow("has bookings");
    });

    it("tells the user to sign in as an admin on 401 or 403", async () => {
        mockFetch(403);
        await expect(deleteRental("r1", "tok")).rejects.toThrow("Sign in as an admin");
    });
});
