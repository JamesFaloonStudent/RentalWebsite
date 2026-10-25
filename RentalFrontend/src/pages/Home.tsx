import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Header from "../components/Header";
import Footer from "../components/Footer";
import PageBand from "../components/PageBand";
import PageSection from "../components/PageSection";
import TabBar from "../components/TabBar";
import ListingCard from "../components/ListingCard";
import { CategoryIcon, PlusIcon, SearchIcon } from "../components/Icons";
import { useAuth } from "../context/auth";
import type { Category } from "../models/Listing";
import { getHeaderDataJsonFile, getListings, getSubHeaderDataJsonFile } from "../services/json";
import { formatMoney } from "../services/format";
import { colors, radius } from "../theme/tokens";
import { controlSx, navLinkSx } from "../theme/styles";

function Home() {
    const { user, signOut } = useAuth();
    const [category, setCategory] = useState<Category>("boats");
    const [draft, setDraft] = useState("");
    const [query, setQuery] = useState("");

    const headerData = getHeaderDataJsonFile();
    const subHeader = getSubHeaderDataJsonFile();
    const listings = getListings().filter(listing => listing.visible);

    const search = query.trim().toLowerCase();
    const results = search
        ? listings.filter(listing => listing.name.toLowerCase().includes(search))
        : listings.filter(listing => listing.category === category);
    const count = results.length;

    function pickCategory(value: Category) {
        setCategory(value);
        setQuery("");
        setDraft("");
    }

    function onSearch(event: FormEvent) {
        event.preventDefault();
        setQuery(draft);
    }

    return (
        <>
            <Header>
                <TabBar
                    label="Rental type"
                    value={search ? null : category}
                    onChange={pickCategory}
                    options={headerData.tabBarOptions.map(option => ({
                        value: option.type,
                        label: option.label,
                        icon: <CategoryIcon category={option.type} />,
                    }))}
                />
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px" }}>
                    <Box component="form" role="search" onSubmit={onSearch} sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Box component="label" htmlFor="listing-search" sx={visuallyHidden}>Search boats and trailers by name</Box>
                        <InputBase
                            id="listing-search"
                            type="search"
                            value={draft}
                            onChange={event => setDraft(event.target.value)}
                            placeholder="Search by name"
                            startAdornment={<Box sx={{ display: "flex", color: colors.inkMuted, mr: "8px" }}><SearchIcon /></Box>}
                            sx={{ ...controlSx(), width: 220 }}
                        />
                        <Button type="submit" variant="contained">Search</Button>
                    </Box>
                    <Box component="nav" aria-label="Account" sx={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <Link component={RouterLink} to="/my-rentals" underline="none" sx={navLinkSx}>My rentals</Link>
                        <Link component={RouterLink} to="/contact" underline="none" sx={navLinkSx}>Contact</Link>
                        {user ? (
                            <Link component="button" type="button" onClick={signOut} underline="none" sx={navLinkSx}>Sign out</Link>
                        ) : (
                            <Link component={RouterLink} to="/login" underline="none" sx={navLinkSx}>Sign in</Link>
                        )}
                    </Box>
                </Box>
            </Header>

            <PageBand size="hero" title={subHeader.title} subtitle={subHeader.subtitle} />

            <PageSection component="main" sx={{ py: { xs: "48px", lg: "64px" }, display: "flex", flexDirection: "column", gap: "32px" }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "24px" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <Typography variant="headingLg">
                            {search ? `Results for “${query.trim()}”` : category === "boats" ? "Boats for rent" : "Trailers for rent"}
                        </Typography>
                        <Typography variant="bodySm" color="text.secondary">
                            {search
                                ? `${count} ${count === 1 ? "rental" : "rentals"} across boats and trailers`
                                : `${count} available · prices per day`}
                        </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {search && (
                            <Button variant="text" size="small" onClick={() => pickCategory(category)}>Clear search</Button>
                        )}
                        {user?.isAdmin && (
                            <Button component={RouterLink} to="/listings/new" variant="outlined" startIcon={<PlusIcon />}>Add listing</Button>
                        )}
                    </Box>
                </Box>

                {search && count === 0 && (
                    <Box sx={{ p: "48px", border: `1px dashed ${colors.borderStrong}`, borderRadius: radius.lg, background: colors.surfaceAlt, textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <Typography variant="headingSm" component="p">No rentals match that name</Typography>
                        <Typography variant="bodySm" color="text.secondary">Check the spelling, or browse all boats and trailers.</Typography>
                    </Box>
                )}

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: "24px" }}>
                    {results.map(listing => (
                        <ListingCard
                            key={listing.id}
                            id={listing.id}
                            category={listing.category}
                            name={listing.name}
                            type={listing.type}
                            description={listing.description}
                            price={formatMoney(listing.pricePerDay)}
                            showEdit={user?.isAdmin}
                        />
                    ))}
                </Box>
            </PageSection>

            <Footer />
        </>
    )
}

const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

export default Home
