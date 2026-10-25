import type { Category } from "./Listing";

export type RentalTab = "upcoming" | "active" | "past";

export type RentalStatus = "Confirmed" | "Out now" | "Completed" | "Cancelled";

export interface Rental {
    id : string;
    listingId : string;
    category : Category;
    name : string;
    reference : string;
    tab : RentalTab;
    status : RentalStatus;
    dates : string;
    handoff : string;
    total : string;
    breakdown : string;
    note : string;
}
