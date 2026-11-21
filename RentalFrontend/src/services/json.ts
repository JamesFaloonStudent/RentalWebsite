import HomePageJson from "../json/HomePage.json"
import type { Header, SubHeader } from "../models/Header"

// Static page content bundled at build time. Listings come from the API (RentalService) and
// a user's own bookings from BookingService.

export function getHeaderDataJsonFile(): Header {
    return HomePageJson.header as Header;
}

export function getSubHeaderDataJsonFile(): SubHeader {
    return HomePageJson.subHeader;
}
