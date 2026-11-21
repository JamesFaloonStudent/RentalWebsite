import type { Category, Listing, ListingDraft } from "../models/Listing";

// Matches RentalWeb's Rental model (System.Text.Json camelCases it); most fields are nullable there
interface ApiRental {
    id : string;
    imageUrl : string | null;
    category : string | null;
    name : string | null;
    type : string | null;
    description : string | null;
    pricePerDay : number;
    location : string | null;
    visible : boolean | null;
    capacity : number | null;
    lengthFt : number | null;
    licence : string | null;
    included : string[] | null;
}

// Matches RentalWeb's RentalInsertRequest record
interface RentalInsertRequest {
    imageUrl : string | null;
    category : Category;
    name : string;
    type : string;
    description : string;
    pricePerDay : number;
    location : string | null;
    visible : boolean;
    capacity : number;
    lengthFt : number;
    licence : string | null;
    included : string[];
}

const RENTAL_URL = "/api/rental";

// The API stores the category as free text ("Boat"), the UI uses "boats" / "trailers"
export function toCategory(value: string | null): Category {
    return value?.toLowerCase().startsWith("trailer") ? "trailers" : "boats";
}

function toListing(rental: ApiRental): Listing {
    return {
        id: rental.id,
        category: toCategory(rental.category),
        name: rental.name ?? "",
        type: rental.type ?? "",
        description: rental.description ?? "",
        pricePerDay: rental.pricePerDay,
        location: rental.location ?? "",
        visible: rental.visible ?? false,
        capacity: rental.capacity ?? undefined,
        lengthFt: rental.lengthFt ?? undefined,
        licence: rental.licence ?? undefined,
        included: rental.included ?? [],
    };
}

// Keeps the fields the form doesn't edit (location, licence, included) from the existing listing
function toInsertRequest(draft: ListingDraft, existing?: Listing): RentalInsertRequest {
    return {
        imageUrl: null,
        category: draft.category,
        name: draft.name.trim(),
        type: draft.type.trim(),
        description: draft.description.trim(),
        pricePerDay: Number(draft.price),
        location: existing?.location || null,
        visible: draft.visible,
        capacity: Number(draft.capacity) || 0,
        lengthFt: Number(draft.lengthFt) || 0,
        licence: existing?.licence ?? null,
        included: existing?.included ?? [],
    };
}

function authHeaders(accessToken: string): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}` };
}

function failure(response: Response, action: string): Error {
    if (response.status === 401 || response.status === 403) {
        return new Error("Your session has expired or you don't have permission to do that. Sign in as an admin and try again.");
    }
    return new Error(`We couldn't ${action} right now. Try again in a moment.`);
}

// GET /api/rental
export async function getAllRentals(): Promise<Listing[]> {
    const response = await fetch(RENTAL_URL);
    if (!response.ok) {
        throw failure(response, "load the rentals");
    }
    return ((await response.json()) as ApiRental[]).map(toListing);
}

// GET /api/rental/{id}; resolves to null when the rental doesn't exist
export async function getRentalById(id: string): Promise<Listing | null> {
    const response = await fetch(`${RENTAL_URL}/${encodeURIComponent(id)}`);
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw failure(response, "load that rental");
    }
    return toListing((await response.json()) as ApiRental);
}

// POST /api/rental (admin)
export async function createRental(draft: ListingDraft, accessToken: string): Promise<Listing> {
    const response = await fetch(RENTAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
        body: JSON.stringify(toInsertRequest(draft)),
    });
    if (!response.ok) {
        throw failure(response, "create the listing");
    }
    return toListing((await response.json()) as ApiRental);
}

// PUT /api/rental/{id} (admin)
export async function updateRental(existing: Listing, draft: ListingDraft, accessToken: string): Promise<Listing> {
    const response = await fetch(`${RENTAL_URL}/${encodeURIComponent(existing.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
        body: JSON.stringify(toInsertRequest(draft, existing)),
    });
    if (!response.ok) {
        throw failure(response, "save your changes");
    }
    return toListing((await response.json()) as ApiRental);
}

// DELETE /api/rental/{id} (admin)
export async function deleteRental(id: string, accessToken: string): Promise<void> {
    const response = await fetch(`${RENTAL_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });
    if (response.status === 409) {
        throw new Error("This listing has bookings, so it can't be deleted. Hide it instead.");
    }
    if (!response.ok) {
        throw failure(response, "delete the listing");
    }
}
