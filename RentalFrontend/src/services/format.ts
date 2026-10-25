import type { Listing } from "../models/Listing";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
    return money.format(amount);
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
