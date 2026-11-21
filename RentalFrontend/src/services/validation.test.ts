import { describe, expect, it } from "vitest";
import type { ListingDraft } from "../models/Listing";
import { hasErrors, isValidEmail, isWholeDollarPrice, listingDraftErrors } from "./validation";

const draft: ListingDraft = { category: "boats", name: "Sea Ray", type: "", description: "", price: "250", capacity: "", lengthFt: "", deckSize: "", hitch: "", visible: true };

describe("isValidEmail", () => {
    it.each(["a@b.co", "  a@b.co  "])("accepts %j", value => expect(isValidEmail(value)).toBe(true));
    it.each(["", "a", "a@b", "a b@c.d", "@b.c"])("rejects %j", value => expect(isValidEmail(value)).toBe(false));
});

describe("isWholeDollarPrice", () => {
    it.each(["1", "250", " 40 "])("accepts %j", value => expect(isWholeDollarPrice(value)).toBe(true));
    it.each(["", "  ", "0", "-5", "12.5", "abc"])("rejects %j", value => expect(isWholeDollarPrice(value)).toBe(false));
});

describe("listingDraftErrors", () => {
    it("has no errors for a valid draft", () => {
        expect(hasErrors(listingDraftErrors(draft))).toBe(false);
    });

    it("flags a blank name and a bad price", () => {
        const errors = listingDraftErrors({ ...draft, name: "  ", price: "0" });
        expect(errors.name).not.toBe("");
        expect(errors.price).not.toBe("");
        expect(hasErrors(errors)).toBe(true);
    });
});
