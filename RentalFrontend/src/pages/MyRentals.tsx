import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Header from "../components/Header";
import Footer from "../components/Footer";
import PageBand from "../components/PageBand";
import PageSection from "../components/PageSection";
import Badge, { type BadgeTone } from "../components/Badge";
import Notice from "../components/Notice";
import PhotoPlaceholder from "../components/PhotoPlaceholder";
import { CalendarIcon, CategoryIcon, PinIcon } from "../components/Icons";
import { useAuth } from "../context/auth";
import type { Rental, RentalStatus, RentalTab } from "../models/Rental";
import { getMyRentals } from "../services/json";
import { colors, radius, typeScale } from "../theme/tokens";
import { navLinkSx, raisedCardSx } from "../theme/styles";

const tabs: { value: RentalTab; label: string; empty: string }[] = [
    { value: "upcoming", label: "Upcoming", empty: "No upcoming rentals yet." },
    { value: "active", label: "Active", empty: "Nothing out right now." },
    { value: "past", label: "Past", empty: "No past rentals yet." },
];

const statusTone: Record<RentalStatus, BadgeTone> = {
    "Confirmed": "success",
    "Out now": "brand",
    "Completed": "neutral",
    "Cancelled": "danger",
};

function MyRentals() {
    const { user, signOut } = useAuth();
    const [tab, setTab] = useState<RentalTab>("upcoming");
    const [cancelledIds, setCancelledIds] = useState<string[]>([]);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const rentals: Rental[] = getMyRentals().map(rental => cancelledIds.includes(rental.id)
        ? { ...rental, tab: "past", status: "Cancelled", breakdown: "Refund on its way", note: "Cancelled just now. Refunds take 5–10 business days." }
        : rental);
    const rows = rentals.filter(rental => rental.tab === tab);
    const current = tabs.find(t => t.value === tab)!;

    return (
        <>
            <Header>
                <Box component="nav" aria-label="Account" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 24px" }}>
                    <Link component={RouterLink} to="/" underline="none" sx={navLinkSx}>Browse rentals</Link>
                    <Link component={RouterLink} to="/my-rentals" aria-current="page" underline="none" sx={{ ...navLinkSx, color: colors.ink, borderBottom: `2px solid ${colors.ink}` }}>My rentals</Link>
                    {user ? (
                        <>
                            <Box component="span" sx={{ ...typeScale.bodySm, display: "inline-flex", alignItems: "center", gap: "8px", color: colors.inkMuted }}>
                                <Box component="span" aria-hidden="true" sx={{ width: 36, height: 36, borderRadius: radius.pill, background: colors.primarySoft, color: colors.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" }}>
                                    {user.email.slice(0, 2).toUpperCase()}
                                </Box>
                                {user.email}
                            </Box>
                            <Link component="button" type="button" onClick={signOut} underline="none" sx={navLinkSx}>Sign out</Link>
                        </>
                    ) : (
                        <Link component={RouterLink} to="/login" underline="none" sx={navLinkSx}>Sign in</Link>
                    )}
                </Box>
            </Header>

            <PageBand title="My rentals" subtitle="Everything you've booked, what's out now, and what's coming up.">
                <Box role="tablist" aria-label="Rental status" sx={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                    {tabs.map(t => {
                        const selected = t.value === tab;
                        const count = rentals.filter(rental => rental.tab === t.value).length;
                        return (
                            <ButtonBase
                                key={t.value}
                                role="tab"
                                aria-selected={selected}
                                onClick={() => { setTab(t.value); setConfirmingId(null); }}
                                sx={{
                                    ...typeScale.body,
                                    fontWeight: 600,
                                    gap: "8px",
                                    height: 48,
                                    px: "16px",
                                    borderBottom: `3px solid ${selected ? colors.ink : "transparent"}`,
                                    color: selected ? colors.ink : colors.inkMuted,
                                }}
                            >
                                {t.label}
                                <Box component="span" sx={{ minWidth: 24, px: "8px", borderRadius: radius.pill, fontSize: "12px", lineHeight: "20px", background: selected ? colors.primarySoft : colors.surfaceSunken, color: selected ? colors.ink : colors.inkMuted }}>
                                    {count}
                                </Box>
                            </ButtonBase>
                        );
                    })}
                </Box>
            </PageBand>

            <PageSection component="main" sx={{ pt: "40px", pb: "64px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {rows.length === 0 && (
                    <Box sx={{ p: "48px", border: `1px dashed ${colors.borderStrong}`, borderRadius: radius.lg, background: colors.surfaceAlt, display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                        <Typography variant="headingSm" component="p">{current.empty}</Typography>
                        <Button component={RouterLink} to="/" variant="contained">Find a rental</Button>
                    </Box>
                )}

                {rows.map(rental => (
                    <Box
                        component="article"
                        key={rental.id}
                        sx={{ ...raisedCardSx, p: "20px", display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "200px minmax(0, 1fr) 200px" }, gap: "24px" }}
                    >
                        <PhotoPlaceholder
                            icon={<CategoryIcon category={rental.category} size={48} strokeWidth={1.25} />}
                            sx={{ aspectRatio: "4 / 3", borderRadius: radius.lg, display: { xs: "none", md: "flex" } }}
                        />

                        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <Badge tone={statusTone[rental.status]}>{rental.status}</Badge>
                                <Typography variant="code" color="text.secondary">{rental.reference}</Typography>
                            </Box>
                            <Typography variant="headingSm" component="h2">
                                <Link component={RouterLink} to={`/listings/${rental.listingId}`} sx={{ color: colors.ink }}>{rental.name}</Link>
                            </Typography>
                            <Box sx={{ ...typeScale.bodySm, display: "flex", flexWrap: "wrap", gap: "8px 24px", color: colors.inkMuted }}>
                                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><CalendarIcon size={16} />{rental.dates}</Box>
                                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><PinIcon size={16} />{rental.handoff}</Box>
                            </Box>
                            {rental.note && (
                                <Typography variant="bodySm" sx={rental.status === "Out now" ? { color: colors.warning, fontWeight: 600 } : { color: colors.inkMuted }}>
                                    {rental.note}
                                </Typography>
                            )}
                            {confirmingId === rental.id && (
                                <Notice
                                    tone="danger"
                                    role="alertdialog"
                                    compact
                                    sx={{ mt: "4px", flexDirection: { md: "row" }, alignItems: { md: "center" }, justifyContent: "space-between" }}
                                    actions={
                                        <>
                                            <Button
                                                variant="contained"
                                                color="error"
                                                size="small"
                                                onClick={() => { setCancelledIds([...cancelledIds, rental.id]); setConfirmingId(null); }}
                                            >
                                                Yes, cancel
                                            </Button>
                                            <Button variant="outlined" size="small" onClick={() => setConfirmingId(null)} sx={{ borderColor: colors.borderStrong, color: colors.ink }}>Keep booking</Button>
                                        </>
                                    }
                                >
                                    Cancel this booking? You'll get a full refund.
                                </Notice>
                            )}
                        </Box>

                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: { md: "flex-end" }, justifyContent: "space-between", gap: "12px" }}>
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: { md: "flex-end" } }}>
                                <Typography variant="price">{rental.total}</Typography>
                                <Typography variant="bodySm" color="text.secondary">{rental.breakdown}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                                {rental.tab === "upcoming" && confirmingId !== rental.id && (
                                    <Button variant="text" color="error" size="small" onClick={() => setConfirmingId(rental.id)}>Cancel booking</Button>
                                )}
                                {rental.tab === "past" && (
                                    <Button component={RouterLink} to={`/listings/${rental.listingId}/book`} variant="outlined" size="small">Book again</Button>
                                )}
                                <Button component={RouterLink} to={`/listings/${rental.listingId}`} variant="text" size="small">View listing</Button>
                            </Box>
                        </Box>
                    </Box>
                ))}
            </PageSection>

            <Footer note="Questions about a booking? [SUPPORT CONTACT]" />
        </>
    )
}

export default MyRentals
