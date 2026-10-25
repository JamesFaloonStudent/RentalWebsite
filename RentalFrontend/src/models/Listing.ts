export type Category = "boats" | "trailers";

export interface Listing {
    id : string;
    category : Category;
    name : string;
    type : string;
    description : string;
    pricePerDay : number;
    location : string;
    visible : boolean;
    // Boats
    capacity? : number;
    lengthFt? : number;
    licence? : string;
    // Trailers
    deckSize? : string;
    hitch? : string;
    included : string[];
}

// Form state for adding or editing a listing; numbers stay strings while being typed
export interface ListingDraft {
    category : Category;
    name : string;
    type : string;
    description : string;
    price : string;
    capacity : string;
    lengthFt : string;
    deckSize : string;
    hitch : string;
    visible : boolean;
}
