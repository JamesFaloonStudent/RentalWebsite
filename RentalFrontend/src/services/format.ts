import type { Listing } from "../models/Listing";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
    return money.format(amount);
}

// Server amounts are integer minor units (cents); show cents only when there are some
export function formatCents(cents: number, currency: string): string {
    const digits = cents % 100 === 0 ? 0 : 2;
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: currency.toUpperCase(),
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(cents / 100);
}

// "Pontoon · 10 guests · 22 ft" / "Enclosed · 6×12 ft · 7-pin, 2-5/16" ball"
export function listingSummary(listing: Listing): string {
    const parts = listing.category === "boats"
        ? [listing.type, `${listing.capacity} guests`, `${listing.lengthFt} ft`]
        : [listing.type, listing.deckSize, listing.hitch];
    return parts.filter(Boolean).join(" · ");
}

export function pluralDays(days: number): string {
    return `${days} ${days === 1 ? "day" : "days"}`;
}
