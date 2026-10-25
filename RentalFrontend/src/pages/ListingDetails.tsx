import { Link as RouterLink, Navigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Header, { BackLink } from "../components/Header";
import Footer from "../components/Footer";
import PageSection from "../components/PageSection";
import Badge from "../components/Badge";
import PhotoPlaceholder from "../components/PhotoPlaceholder";
import { CategoryIcon, CheckIcon, PencilIcon } from "../components/Icons";
import { useAuth } from "../context/auth";
import type { Listing } from "../models/Listing";
import { getListingById } from "../services/json";
import { formatMoney, listingSummary } from "../services/format";
import { colors, radius, shadows } from "../theme/tokens";
import { cardSx, navLinkSx, stickySx, twoColumnSx } from "../theme/styles";

function specsFor(listing: Listing) {
    return listing.category === "boats"
        ? [["Capacity", `${listing.capacity} guests`], ["Length", `${listing.lengthFt} ft`], ["Type", listing.type], ["Licence", listing.licence]]
        : [["Deck size", listing.deckSize], ["Hitch", listing.hitch], ["Type", listing.type]];
}

function ListingDetails() {
    const { id } = useParams();
    const { user } = useAuth();
    const listing = getListingById(id);

    if (!listing) {
        return <Navigate to="/" replace />;
    }

    const categoryLabel = listing.category === "boats" ? "Boats" : "Trailers";
    const noun = listing.category === "boats" ? "boat" : "trailer";

    return (
        <>
            <Header>
                <BackLink />
            </Header>

            <PageSection component="main" sx={{ pt: "40px", pb: "64px", display: "flex", flexDirection: "column", gap: "32px" }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "24px" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <Typography component="nav" aria-label="Breadcrumb" variant="bodySm" color="text.secondary">
                            <Link component={RouterLink} to="/">{categoryLabel}</Link> / {listing.type}
                        </Typography>
                        <Typography variant="displayLg">{listing.name}</Typography>
                        <Typography variant="body" color="text.secondary">{listingSummary(listing)} · {listing.location}</Typography>
                    </Box>
                    {user?.isAdmin && (
                        <Button component={RouterLink} to={`/listings/${listing.id}/edit`} variant="outlined" startIcon={<PencilIcon />}>Edit details</Button>
                    )}
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "2fr 1fr" }, gap: "16px", height: { md: 460 } }}>
                    <PhotoPlaceholder
                        icon={<CategoryIcon category={listing.category} size={80} strokeWidth={1.1} />}
                        label="Hero photo 16:9"
                        sx={{ borderRadius: radius.xl, aspectRatio: { xs: "16 / 9", md: "auto" } }}
                    />
                    <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateRows: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
                        <PhotoPlaceholder label="Photo 2" sx={{ borderRadius: radius.lg }} />
                        <PhotoPlaceholder label="Photo 3 · See all photos" sx={{ borderRadius: radius.lg }} />
                    </Box>
                </Box>

                <Box sx={twoColumnSx(400)}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                        <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <Typography variant="headingLg">About this {noun}</Typography>
                            <Typography variant="bodyLg" sx={{ maxWidth: 680 }}>{listing.description}</Typography>
                        </Box>
                        <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <Typography variant="headingMd">Specs</Typography>
                            <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: "16px" }}>
                                {specsFor(listing).map(([term, value]) => (
                                    <Box key={term} sx={{ ...cardSx, p: "16px" }}>
                                        <Typography component="dt" variant="bodySm" color="text.secondary">{term}</Typography>
                                        <Typography component="dd" variant="headingSm" sx={{ m: "4px 0 0" }}>{value}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                        {listing.included.length > 0 && (
                            <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <Typography variant="headingMd">What's included</Typography>
                                <Box component="ul" sx={{ m: 0, pl: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {listing.included.map(item => <Typography component="li" variant="body" key={item}>{item}</Typography>)}
                                </Box>
                            </Box>
                        )}
                    </Box>

                    <Box component="aside" aria-label={`Book this ${noun}`} sx={{ ...cardSx, ...stickySx, p: "24px", boxShadow: shadows.md, display: "flex", flexDirection: "column", gap: "16px" }}>
                        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                            <Typography component="p" sx={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                                <Typography variant="price" component="span">{formatMoney(listing.pricePerDay)}</Typography>
                                <Typography variant="bodySm" component="span" color="text.secondary">/ day</Typography>
                            </Typography>
                            <Badge tone="success" icon={<CheckIcon size={14} />}>Available</Badge>
                        </Box>
                        <Button component={RouterLink} to={`/listings/${listing.id}/book`} variant="contained" size="large" fullWidth>Reserve</Button>
                        <Typography variant="bodySm" color="text.secondary" sx={{ textAlign: "center" }}>Free cancellation until 48 hours before pickup.</Typography>
                        <Box sx={{ pt: "16px", borderTop: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center" }}>
                            <Typography variant="bodySm" color="text.secondary">Longer trip, event or custom delivery?</Typography>
                            <Link component={RouterLink} to="/contact" underline="none" sx={navLinkSx}>Contact the owner</Link>
                        </Box>
                    </Box>
                </Box>
            </PageSection>

            <Footer />
        </>
    )
}

export default ListingDetails
