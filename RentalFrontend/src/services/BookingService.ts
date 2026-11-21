import type { Rental, RentalStatus, RentalTab } from "../models/Rental";
import { apiRequest } from "./api";
import { formatCents, pluralDays } from "./format";
import { toCategory } from "./RentalService";

// Matches RentalWeb's BookingSummaryResponse record. Dates are "yyyy-MM-dd", money is in cents.
export interface ApiBooking {
    bookingId : string;
    rentalId : string;
    rentalName : string | null;
    category : string | null;
    startDate : string;
    endDate : string;
    days : number;
    unitPriceCents : number;
    totalAmountCents : number;
    currency : string;
    status : "PendingPayment" | "Confirmed" | "Cancelled" | "Expired" | "Refunded";
    expiresAt : string;
    createdAt : string;
    payment : { status : string; amountRefundedCents : number } | null;
}

// GET /api/bookings: the signed-in user's own bookings, newest first
export async function getMyRentals(accessToken: string | null): Promise<Rental[]> {
    if (!accessToken) {
        return [];
    }
    const bookings = await apiRequest<ApiBooking[]>("/api/bookings", accessToken, "We couldn't load your rentals right now. Try again in a moment.");
    const now = new Date();
    return bookings.map(booking => toRental(booking, now));
}

const dayFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric" });

// "2026-10-10" as a local date (new Date("2026-10-10") would be UTC and can show the day before)
function parseDay(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function dayKey(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function statusAndTab(booking: ApiBooking, now: Date): { status: RentalStatus; tab: RentalTab } {
    const today = dayKey(now);
    switch (booking.status) {
        case "PendingPayment":
            // The server releases unpaid bookings after their hold; show it as gone once the hold has passed
            return new Date(booking.expiresAt) < now
                ? { status: "Expired", tab: "past" }
                : { status: "Awaiting payment", tab: "upcoming" };
        case "Confirmed":
            if (booking.endDate < today) return { status: "Completed", tab: "past" };
            if (booking.startDate <= today) return { status: "Out now", tab: "active" };
            return { status: "Confirmed", tab: "upcoming" };
        case "Cancelled":
            return { status: "Cancelled", tab: "past" };
        case "Refunded":
            return { status: "Refunded", tab: "past" };
        case "Expired":
            return { status: "Expired", tab: "past" };
    }
}

export function noteFor(booking: ApiBooking, status: RentalStatus): string {
    const refunded = booking.payment?.amountRefundedCents ?? 0;
    switch (status) {
        case "Awaiting payment":
            return `Payment isn't complete. We're holding these dates until ${new Date(booking.expiresAt).toLocaleTimeString("en-CA", { timeStyle: "short" })}.`;
        case "Out now":
            return `Return by the end of ${dayFormat.format(parseDay(booking.endDate))}.`;
        case "Cancelled":
        case "Refunded":
            return refunded > 0 ? `${formatCents(refunded, booking.currency)} refunded. Refunds take 5–10 business days.` : "";
        case "Expired":
            return "Payment wasn't completed, so these dates were released.";
        default:
            return "";
    }
}

export function toRental(booking: ApiBooking, now: Date): Rental {
    const { status, tab } = statusAndTab(booking, now);
    const id = booking.bookingId.replace(/-/g, "").toUpperCase();
    return {
        id: booking.bookingId,
        listingId: booking.rentalId,
        category: toCategory(booking.category),
        name: booking.rentalName ?? "Rental",
        reference: `HH-${id.slice(0, 4)}-${id.slice(4, 8)}`,
        tab,
        status,
        dates: `${dayFormat.format(parseDay(booking.startDate))} – ${dayFormat.format(parseDay(booking.endDate))} · ${pluralDays(booking.days)}`,
        total: formatCents(booking.totalAmountCents, booking.currency),
        breakdown: `${formatCents(booking.unitPriceCents, booking.currency)} × ${pluralDays(booking.days)}`,
        note: noteFor(booking, status),
    };
}
