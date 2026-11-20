import type { Listing } from "../models/Listing";

// Matches RentalWeb's RentalInsertRequest record (System.Text.Json camelCases it)
export type RentalInsertRequest = Pick<Listing, "category" | "name" | "type" | "description" | "pricePerDay" | "location" | "visible"> & {
    imageUrl? : string;
    capacity : number;
    lengthFt : number;
    licence? : string;
    included? : string[];
};

const RENTAL_URL = "/api/rental";

function authHeaders(accessToken?: string): Record<string, string> {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// GET /api/rental
export async function getAllRentals(): Promise<Listing[]> {
    const response = await fetch(RENTAL_URL);
    if (!response.ok) {
        throw new Error("We couldn't load the rentals right now. Try again in a moment.");
    }
    return response.json() as Promise<Listing[]>;
}

// GET /api/rental/{id}; resolves to null when the rental doesn't exist
export async function getRentalById(id: string): Promise<Listing | null> {
    const response = await fetch(`${RENTAL_URL}/${encodeURIComponent(id)}`);
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error("We couldn't load that rental right now. Try again in a moment.");
    }
    return response.json() as Promise<Listing>;
}

// POST /api/rental
export async function createRental(rental: RentalInsertRequest, accessToken?: string): Promise<Listing> {
    const response = await fetch(RENTAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
        body: JSON.stringify(rental),
    });
    if (!response.ok) {
        throw new Error("We couldn't create the rental right now. Try again in a moment.");
    }
    return response.json() as Promise<Listing>;
}

// DELETE /api/rental/{id}; resolves to false when the rental doesn't exist
export async function deleteRental(id: string, accessToken?: string): Promise<boolean> {
    const response = await fetch(`${RENTAL_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });
    if (response.status === 404) {
        return false;
    }
    if (!response.ok) {
        throw new Error("We couldn't delete the rental right now. Try again in a moment.");
    }
    return true;
}
