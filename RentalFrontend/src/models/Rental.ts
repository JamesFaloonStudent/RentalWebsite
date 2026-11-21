import type { Category } from "./Listing";

export type RentalTab = "upcoming" | "active" | "past";

export type RentalStatus = "Awaiting payment" | "Confirmed" | "Out now" | "Completed" | "Cancelled" | "Refunded" | "Expired";

// A booking as shown on the My rentals page: display strings derived from the API's booking
export interface Rental {
    id : string;
    listingId : string;
    category : Category;
    name : string;
    reference : string;
    tab : RentalTab;
    status : RentalStatus;
    dates : string;
    total : string;
    breakdown : string;
    note : string;
}
