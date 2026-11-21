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
import { CalendarIcon, CategoryIcon } from "../components/Icons";
import { useAuth } from "../context/auth";
import type { Rental, RentalStatus, RentalTab } from "../models/Rental";
import { getMyRentals } from "../services/BookingService";
import { cancelBooking, cancelPendingBooking, getCancelQuote, type CancelBookingResponse, type CancellationQuote } from "../services/StripeService";
import { formatCents } from "../services/format";
import { useRemote } from "../services/useRemote";
import { colors, radius, typeScale } from "../theme/tokens";
import { navLinkSx, raisedCardSx } from "../theme/styles";

const tabs: { value: RentalTab; label: string; empty: string }[] = [
    { value: "upcoming", label: "Upcoming", empty: "No upcoming rentals yet." },
    { value: "active", label: "Active", empty: "Nothing out right now." },
    { value: "past", label: "Past", empty: "No past rentals yet." },
];

const statusTone: Record<RentalStatus, BadgeTone> = {
    "Awaiting payment": "warning",
    "Confirmed": "success",
    "Out now": "brand",
    "Completed": "neutral",
    "Cancelled": "danger",
    "Refunded": "neutral",
    "Expired": "neutral",
};

// What the user should be told about cancelling, from the server's own quote
function quoteMessage(quote: CancellationQuote): string {
    if (quote.lateCancellation) {
        return `This booking starts within ${quote.cancellationWindowDays} days, so a ${quote.feePercent}% fee (${formatCents(quote.feeCents, quote.currency)}) is kept. You'll be refunded ${formatCents(quote.refundCents, quote.currency)}.`;
    }
    return `You'll get a full refund of ${formatCents(quote.refundCents, quote.currency)}.`;
}

function MyRentals() {
    const { user, signOut } = useAuth();
    const [tab, setTab] = useState<RentalTab>("upcoming");
    const { data, error, loading } = useRemote(getMyRentals, user?.accessToken ?? null);
    const [cancelled, setCancelled] = useState<Record<string, CancelBookingResponse>>({});
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [quote, setQuote] = useState<CancellationQuote | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Bookings cancelled in this visit show their new state without a reload
    const rentals: Rental[] = (data ?? []).map(rental => {
        const result = cancelled[rental.id];
        if (!result) {
            return rental;
        }
        return {
            ...rental,
            tab: "past",
            status: result.status === "Refunded" ? "Refunded" : "Cancelled",
            note: result.refundCents > 0 ? "Refund on its way. Refunds take 5–10 business days." : "",
        };
    });

    function closeConfirm() {
        setConfirmingId(null);
        setQuote(null);
        setActionError(null);
    }

    // Unpaid bookings have nothing to refund; paid ones ask the server what cancelling costs first
    async function startCancel(rental: Rental) {
        if (!user) return;
        setConfirmingId(rental.id);
        setQuote(null);
        setActionError(null);
        if (rental.status === "Awaiting payment") return;
        try {
            setQuote(await getCancelQuote(rental.id, user.accessToken));
        } catch (e) {
            setActionError((e as Error).message);
        }
    }

    async function confirmCancel(rental: Rental) {
        if (!user) return;
        setBusy(true);
        setActionError(null);
        try {
            const cancel = rental.status === "Awaiting payment" ? cancelPendingBooking : cancelBooking;
            const result = await cancel(rental.id, user.accessToken);
            setCancelled({ ...cancelled, [rental.id]: result });
            closeConfirm();
        } catch (e) {
            setActionError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
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
                                onClick={() => { setTab(t.value); closeConfirm(); }}
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
                {!user && (
                    <Notice tone="info" title="Sign in to see your rentals" actions={<Button component={RouterLink} to="/login" variant="contained">Sign in</Button>}>
                        Your bookings are tied to your Google account.
                    </Notice>
                )}
                {user && loading && <Typography variant="body" color="text.secondary">Loading your rentals…</Typography>}
                {user && error && <Notice tone="danger" role="alert">{error}</Notice>}

                {user && !loading && !error && rows.length === 0 && (
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
                                                disabled={busy || (!quote && rental.status !== "Awaiting payment")}
                                                onClick={() => confirmCancel(rental)}
                                            >
                                                Yes, cancel
                                            </Button>
                                            <Button variant="outlined" size="small" onClick={closeConfirm} disabled={busy} sx={{ borderColor: colors.borderStrong, color: colors.ink }}>Keep booking</Button>
                                        </>
                                    }
                                >
                                    {actionError
                                        ?? (rental.status === "Awaiting payment"
                                            ? "Cancel this unpaid booking? The dates will be released."
                                            : quote ? `Cancel this booking? ${quoteMessage(quote)}` : "Checking what you'd get back…")}
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
                                    <Button variant="text" color="error" size="small" onClick={() => startCancel(rental)}>Cancel booking</Button>
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
