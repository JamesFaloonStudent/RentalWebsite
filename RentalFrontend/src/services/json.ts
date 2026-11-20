import HomePageJson from "../json/HomePage.json"
import MyRentalsJson from "../json/MyRentals.json"
import type { Header, SubHeader } from "../models/Header"
import type { Rental } from "../models/Rental"

// Static page content bundled at build time. Listings come from the API (RentalService); the
// My rentals sample data stays here until the API can list a user's own bookings.

export function getHeaderDataJsonFile(): Header {
    return HomePageJson.header as Header;
}

export function getSubHeaderDataJsonFile(): SubHeader {
    return HomePageJson.subHeader;
}

export function getMyRentals(): Rental[] {
    return MyRentalsJson as Rental[];
}
