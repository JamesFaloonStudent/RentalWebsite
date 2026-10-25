import type { ListingDraft } from "../models/Listing";

export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Mirrors the Identity password policy in RentalWeb/security/AuthenticationSetup.cs
export const passwordRules = [
    { text: "At least 8 characters", test: (value: string) => value.length >= 8 },
    { text: "At least one number", test: (value: string) => /\d/.test(value) },
    { text: "An uppercase and a lowercase letter", test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
];

export function isWholeDollarPrice(value: string): boolean {
    const amount = Number(value);
    return value.trim() !== "" && Number.isInteger(amount) && amount > 0;
}

export function listingDraftErrors(draft: ListingDraft) {
    return {
        name: draft.name.trim() ? "" : "Enter a name renters will recognise, like the make and model.",
        price: isWholeDollarPrice(draft.price) ? "" : "Enter a whole-dollar price above $0.",
    };
}

export function hasErrors(errors: Record<string, string>): boolean {
    return Object.values(errors).some(Boolean);
}
