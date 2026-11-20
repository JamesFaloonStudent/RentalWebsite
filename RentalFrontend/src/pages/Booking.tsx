import { useState } from "react";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import Header, { BackLink } from "../components/Header";
import PageBand from "../components/PageBand";
import PageSection from "../components/PageSection";
import SectionCard from "../components/SectionCard";
import FormField from "../components/FormField";
import ChipGroup from "../components/ChipGroup";
import ChoiceCard from "../components/ChoiceCard";
import Notice from "../components/Notice";
import PhotoPlaceholder from "../components/PhotoPlaceholder";
import { CalendarIcon, CategoryIcon } from "../components/Icons";
import RemoteStatus from "../components/RemoteStatus";
import { useAuth } from "../context/auth";
import { createCheckout } from "../services/StripeService";
import { getRentalById } from "../services/RentalService";
import { useRemote } from "../services/useRemote";
import { formatMoney, listingSummary, pluralDays } from "../services/format";
import { colors, radius, shadows, typeScale } from "../theme/tokens";
import { cardSx, controlBorder, stickySx, twoColumnSx } from "../theme/styles";

const MAX_DAYS = 14;
const DAY_MS = 86_400_000;

const quickPicks = [
    { value: 1, label: "1 day" },
    { value: 2, label: "Weekend · 2 days" },
    { value: 3, label: "Long weekend · 3 days" },
    { value: 7, label: "Week · 7 days" },
];

const dayFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// <input type="date"> values are calendar dates, so do the maths in UTC to avoid time-zone shifts
function parseDate(value: string) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function tomorrow() {
    const date = new Date(Date.now() + DAY_MS);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Booking() {
    const { id = "" } = useParams();
    const { user } = useAuth();
    const remote = useRemote(getRentalById, id);
    const listing = remote.data;
    const [start, setStart] = useState(tomorrow);
    const [days, setDays] = useState(3);
    const [handoff, setHandoff] = useState<"pickup" | "deliver">("pickup");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    if (remote.loading || remote.error) {
        return (
            <>
                <Header>
                    <BackLink />
                </Header>
                <PageSection component="main" sx={{ py: "64px" }}>
                    <RemoteStatus loading={remote.loading} error={remote.error} what="this rental" />
                </PageSection>
            </>
        );
    }
    if (!listing || !listing.visible) {
        return <Navigate to="/" replace />;
    }

    const startDate = parseDate(start);
    const endDate = startDate ? new Date(startDate.getTime() + days * DAY_MS) : null;
    const subtotal = listing.pricePerDay * days;
    const total = formatMoney(subtotal);
    const noun = listing.category === "boats" ? "boat" : "trailer";

    function update(change: () => void) {
        change();
        setError("");
    }

    // The server prices the booking and creates the Stripe Checkout session; the browser just follows the link
    async function pay() {
        if (!user || !startDate || !endDate) {
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            const checkout = await createCheckout(listing!.id, start, endDate.toISOString().slice(0, 10), user.accessToken);
            window.location.assign(checkout.url);
        } catch (failure) {
            setError((failure as Error).message);
            setSubmitting(false);
        }
    }

    return (
        <>
            <Header>
                <BackLink />
            </Header>

            <PageBand title="Fast, easy booking" subtitle="Pick what you need, choose your dates and book. The price updates as you go." />

            <PageSection sx={{ py: "48px", ...twoColumnSx(440) }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                    <SectionCard title="1. Rental dates">
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: "24px" }}>
                            <FormField
                                id="start-date"
                                label="Start date"
                                type="date"
                                value={start}
                                onChange={event => update(() => setStart(event.target.value))}
                                inputProps={{ min: tomorrow() }}
                                helper="Pickup from 9:00 am"
                                error={!startDate && "Choose a start date."}
                            />
                            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <Typography id="days-label" variant="label">Number of days</Typography>
                                <Box role="group" aria-labelledby="days-label" sx={{ height: 48, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", border: controlBorder(false), borderRadius: radius.md, overflow: "hidden" }}>
                                    <ButtonBase aria-label="Fewer days" disabled={days <= 1} onClick={() => update(() => setDays(days - 1))} sx={stepperSx}>−</ButtonBase>
                                    <Box component="output" aria-live="polite" sx={{ ...typeScale.body, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{pluralDays(days)}</Box>
                                    <ButtonBase aria-label="More days" disabled={days >= MAX_DAYS} onClick={() => update(() => setDays(days + 1))} sx={stepperSx}>+</ButtonBase>
                                </Box>
                                <Typography variant="bodySm" color="text.secondary">
                                    {endDate ? `Return by 6:00 pm, ${dayFormat.format(endDate)}` : "Return by 6:00 pm"}
                                </Typography>
                            </Box>
                        </Box>
                        <ChipGroup label="Quick picks" options={quickPicks} value={days} onChange={value => update(() => setDays(value))} />
                    </SectionCard>

                    <SectionCard title="2. Pickup or delivery">
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: "16px" }}>
                            <ChoiceCard
                                name="handoff"
                                checked={handoff === "pickup"}
                                onChange={() => update(() => setHandoff("pickup"))}
                                title="Pick up"
                                description="Pick up at our Burlington yard near Guelph Line."
                                detail={<Box component="span" sx={{ color: colors.success }}>Free</Box>}
                            />
                            <ChoiceCard
                                name="handoff"
                                checked={handoff === "deliver"}
                                onChange={() => update(() => setHandoff("deliver"))}
                                title={`Deliver the ${noun} to me`}
                                description="We drop it off at your launch or dock and collect it after."
                                detail="Fee quoted after booking"
                            />
                        </Box>
                        {handoff === "deliver" && (
                            <FormField
                                id="deliver-to"
                                label="Delivery address"
                                autoComplete="street-address"
                                placeholder="Street, city, or marina and slip number"
                                helper="We'll confirm the delivery area and fee with you after you book: [DELIVERY RADIUS]"
                            />
                        )}
                    </SectionCard>

                    <SectionCard title="3. Payment">
                        <Typography variant="body">
                            You'll enter your card on Stripe's secure payment page, so card details never touch our site.
                            Your dates are held for a short time while you pay.
                        </Typography>
                    </SectionCard>
                </Box>

                <Box component="aside" aria-label="Booking summary" sx={{ ...cardSx, ...stickySx, overflow: "hidden", boxShadow: shadows.md, display: "flex", flexDirection: "column" }}>
                    <PhotoPlaceholder icon={<CategoryIcon category={listing.category} size={56} strokeWidth={1.25} />} sx={{ aspectRatio: "16 / 9" }} />
                    <Box sx={{ p: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <Typography variant="headingSm" component="h2">{listing.name}</Typography>
                            <Typography variant="bodySm" color="text.secondary">{listingSummary(listing)}</Typography>
                        </Box>
                        <Box sx={{ ...typeScale.bodySm, display: "flex", alignItems: "center", gap: "8px", p: "12px", borderRadius: radius.md, background: colors.surfaceAlt }}>
                            <Box component="span" sx={{ display: "flex", color: colors.inkMuted }}><CalendarIcon /></Box>
                            {startDate && endDate ? `${dayFormat.format(startDate)} – ${dayFormat.format(endDate)}` : "Choose a start date"}
                        </Box>
                        <Box component="dl" sx={{ ...typeScale.body, m: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                            <SummaryRow term={`${formatMoney(listing.pricePerDay)} × ${pluralDays(days)}`} value={formatMoney(subtotal)} />
                            <SummaryRow term={handoff === "deliver" ? "Delivery" : "Pickup"} value={handoff === "deliver" ? "Quoted later" : "Free"} />
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", pt: "12px", borderTop: `1px solid ${colors.border}` }}>
                                <Box component="dt" sx={{ fontWeight: 600 }}>Total</Box>
                                <Box component="dd" sx={{ ...typeScale.price, m: 0 }}>{total}</Box>
                            </Box>
                        </Box>
                        {error && <Notice tone="danger" role="alert" compact>{error}</Notice>}
                        {user ? (
                            <Button variant="contained" size="large" fullWidth disabled={!startDate || submitting} onClick={pay}>
                                {submitting ? "Taking you to Stripe…" : `Pay ${total} and reserve`}
                            </Button>
                        ) : (
                            <Button component={RouterLink} to="/login" variant="contained" size="large" fullWidth>Sign in to book</Button>
                        )}
                        <Typography variant="bodySm" color="text.secondary" sx={{ textAlign: "center" }}>Free cancellation until 48 hours before pickup.</Typography>
                    </Box>
                </Box>
            </PageSection>
        </>
    )
}

function SummaryRow({ term, value }: { term: string; value: string }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box component="dt" sx={{ color: colors.inkMuted }}>{term}</Box>
            <Box component="dd" sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}>{value}</Box>
        </Box>
    );
}

const stepperSx = {
    width: 48,
    height: "100%",
    background: colors.surfaceAlt,
    color: colors.ink,
    fontSize: "22px",
    "&.Mui-disabled": { color: colors.border },
} as const;

export default Booking
