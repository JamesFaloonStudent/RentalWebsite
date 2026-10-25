import HomePageJson from "../json/HomePage.json"
import ListingsJson from "../json/Listings.json"
import MyRentalsJson from "../json/MyRentals.json"
import type { Header, SubHeader } from "../models/Header"
import type { Listing } from "../models/Listing"
import type { Rental } from "../models/Rental"

// Static content and sample data bundled at build time. Swap these for /api calls once the
// backend serves listings and bookings.

export function getHeaderDataJsonFile(): Header {
    return HomePageJson.header as Header;
}

export function getSubHeaderDataJsonFile(): SubHeader {
    return HomePageJson.subHeader;
}

export function getListings(): Listing[] {
    return ListingsJson as Listing[];
}

export function getListingById(id: string | undefined): Listing | undefined {
    return getListings().find(listing => listing.id === id);
}

export function getMyRentals(): Rental[] {
    return MyRentalsJson as Rental[];
}
