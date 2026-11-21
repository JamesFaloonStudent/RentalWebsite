import { apiRequest } from "./api";

// Matches RentalWeb's CheckoutResponse record
export interface CheckoutResponse {
    bookingId : string;
    url : string;
}

// POST /api/stripe/checkout. The server prices the booking itself; only the rental and dates are sent.
export async function createCheckout(rentalId: string, startDate: string, endDate: string, accessToken: string): Promise<CheckoutResponse> {
    const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ rentalId, startDate, endDate }),
    });

    if (response.status === 401) {
        throw new Error("Your session has expired. Sign in again to book.");
    }
    if (!response.ok) {
        // 400/404/409 carry a { message } the user can act on (dates taken, past dates...)
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "We couldn't start your payment right now. Try again in a moment.");
    }
    return response.json() as Promise<CheckoutResponse>;
}

// Matches RentalWeb's CancellationQuote record
export interface CancellationQuote {
    bookingId : string;
    paidCents : number;
    feeCents : number;
    refundCents : number;
    lateCancellation : boolean;
    cancellationWindowDays : number;
    feePercent : number;
    currency : string;
}

// Matches RentalWeb's CancelBookingResponse record
export interface CancelBookingResponse {
    bookingId : string;
    status : string;
    feeCents : number;
    refundCents : number;
}

// What cancelling a paid booking would cost right now. The server works out the fee and refund.
export function getCancelQuote(bookingId: string, accessToken: string): Promise<CancellationQuote> {
    return apiRequest<CancellationQuote>(`/api/stripe/bookings/${encodeURIComponent(bookingId)}/cancel-quote`, accessToken, "We couldn't work out the refund right now. Try again in a moment.");
}

// Cancels a paid booking and refunds it according to the cancellation policy
export function cancelBooking(bookingId: string, accessToken: string): Promise<CancelBookingResponse> {
    return apiRequest<CancelBookingResponse>(`/api/stripe/bookings/${encodeURIComponent(bookingId)}/cancel`, accessToken, "We couldn't cancel this booking right now. Try again in a moment.", "POST");
}

// Abandons a booking whose payment was never completed
export function cancelPendingBooking(bookingId: string, accessToken: string): Promise<CancelBookingResponse> {
    return apiRequest<CancelBookingResponse>(`/api/stripe/bookings/${encodeURIComponent(bookingId)}/cancel-pending`, accessToken, "We couldn't cancel this booking right now. Try again in a moment.", "POST");
}
