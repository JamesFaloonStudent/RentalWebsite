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
