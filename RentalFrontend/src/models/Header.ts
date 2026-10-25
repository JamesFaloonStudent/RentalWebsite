import type { Category } from "./Listing";

export interface Header {
    title : string;
    logoPath : string;
    tagline : string;
    tabBarOptions : TabBarOptions[];
}

export interface TabBarOptions {
    type : Category;
    label : string;
}

export interface SubHeader {
    title : string;
    subtitle : string;
}
