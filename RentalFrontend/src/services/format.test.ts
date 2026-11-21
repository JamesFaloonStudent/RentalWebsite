import { describe, expect, it } from "vitest";
import type { Listing } from "../models/Listing";
import { formatCents, formatMoney, listingSummary, pluralDays } from "./format";

const base: Listing = { id: "1", category: "boats", name: "n", type: "Pontoon", description: "", pricePerDay: 100, location: "", visible: true, included: [] };

describe("formatCents", () => {
    it("shows no cents for whole dollar amounts", () => {
        expect(formatCents(104700, "cad")).toBe("$1,047");
    });

    it("shows cents when there are some", () => {
        expect(formatCents(104750, "cad")).toBe("$1,047.50");
    });

    it("accepts the lowercase currency codes the API sends", () => {
        expect(formatCents(5000, "cad")).toBe(formatCents(5000, "CAD"));
    });

    it("formats zero", () => {
        expect(formatCents(0, "cad")).toBe("$0");
    });
});

describe("formatMoney", () => {
    it("formats whole dollars", () => {
        expect(formatMoney(349)).toBe("$349");
    });
});

describe("pluralDays", () => {
    it("uses the singular for one day", () => {
        expect(pluralDays(1)).toBe("1 day");
    });

    it("uses the plural otherwise", () => {
        expect(pluralDays(3)).toBe("3 days");
        expect(pluralDays(0)).toBe("0 days");
    });
});

describe("listingSummary", () => {
    it("describes a boat by type, guests and length", () => {
        expect(listingSummary({ ...base, capacity: 10, lengthFt: 22 })).toBe("Pontoon · 10 guests · 22 ft");
    });

    it("describes a trailer by type, deck and hitch, skipping blanks", () => {
        expect(listingSummary({ ...base, category: "trailers", type: "Enclosed", deckSize: "6×12 ft" })).toBe("Enclosed · 6×12 ft");
    });
});
