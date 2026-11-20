import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Header, { BackLink } from "../components/Header";
import PageBand from "../components/PageBand";
import PageSection from "../components/PageSection";
import Notice from "../components/Notice";
import Badge from "../components/Badge";
import ListingForm, { ListingPreview } from "../components/ListingForm";
import { CheckIcon } from "../components/Icons";
import type { Listing, ListingDraft } from "../models/Listing";
import RemoteStatus from "../components/RemoteStatus";
import { useAuth } from "../context/auth";
import { deleteRental, getRentalById, updateRental } from "../services/RentalService";
import { useRemote } from "../services/useRemote";
import { hasErrors, listingDraftErrors } from "../services/validation";
import { colors, radius } from "../theme/tokens";
import { stickySx, twoColumnSx } from "../theme/styles";

function toDraft(listing: Listing): ListingDraft {
    return {
        category: listing.category,
        name: listing.name,
        type: listing.type,
        description: listing.description,
        price: String(listing.pricePerDay),
        capacity: listing.capacity?.toString() ?? "",
        lengthFt: listing.lengthFt?.toString() ?? "",
        deckSize: listing.deckSize ?? "",
        hitch: listing.hitch ?? "",
        visible: listing.visible,
    };
}

// Loads the listing, then hands it to the editor so the form state starts from the saved values
function EditListing() {
    const { id = "" } = useParams();
    const remote = useRemote(getRentalById, id);

    if (remote.loading || remote.error) {
        return (
            <>
                <Header>
                    <BackLink>Back to listings</BackLink>
                </Header>
                <PageSection component="main" sx={{ py: "64px" }}>
                    <RemoteStatus loading={remote.loading} error={remote.error} what="this listing" />
                </PageSection>
            </>
        );
    }
    if (!remote.data) {
        return <Navigate to="/" replace />;
    }
    return <ListingEditor key={remote.data.id} initial={remote.data} />;
}

function ListingEditor({ initial }: { initial: Listing }) {
    const { user } = useAuth();
    const [listing, setListing] = useState(initial);
    const [draft, setDraft] = useState(() => toDraft(initial));
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleted, setDeleted] = useState(false);

    const errors = listingDraftErrors(draft);
    const detailsPath = `/listings/${listing.id}`;

    function onChange(next: ListingDraft) {
        setDraft(next);
        setDirty(true);
        setSaved(false);
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitted(true);
        if (hasErrors(errors) || !user) {
            return;
        }
        setSaving(true);
        setFailure("");
        try {
            setListing(await updateRental(listing, draft, user.accessToken));
            setSaved(true);
            setDirty(false);
        } catch (error) {
            setFailure((error as Error).message);
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!user) {
            return;
        }
        setConfirmingDelete(false);
        setFailure("");
        try {
            await deleteRental(listing.id, user.accessToken);
            setDeleted(true);
        } catch (error) {
            setFailure((error as Error).message);
        }
    }

    return (
        <>
            <Header>
                <BackLink>Back to listings</BackLink>
            </Header>

            <PageBand
                above={
                    <Typography component="nav" aria-label="Breadcrumb" variant="bodySm" color="text.secondary">
                        <Link component={RouterLink} to="/">Listings</Link> / <Link component={RouterLink} to={detailsPath}>{listing.name}</Link> / Edit
                    </Typography>
                }
                title="Edit listing"
                titleAside={draft.visible
                    ? <Badge tone="success" icon={<CheckIcon size={14} />}>Live on site</Badge>
                    : <Badge tone="neutral">Hidden</Badge>}
                subtitle={<>Listing ID <Typography variant="code" component="span">{listing.id}</Typography> </>}
            />

            {deleted ? (
                <PageSection sx={{ py: "64px" }}>
                    <Notice
                        tone="danger"
                        title="Listing deleted"
                        sx={{ maxWidth: 640 }}
                        actions={
                            <>
                                <Button component={RouterLink} to="/" variant="contained">Back to all listings</Button>
                                
                            </>
                        }
                    >
                        {draft.name.trim()} has been removed and no longer shows in search.
                    </Notice>
                </PageSection>
            ) : (
                <PageSection sx={{ py: "48px", ...twoColumnSx(400) }}>
                    <ListingForm
                        id="edit-listing"
                        variant="edit"
                        draft={draft}
                        onChange={onChange}
                        onSubmit={onSubmit}
                        errors={errors}
                        showErrors={submitted}
                        visibility={{
                            live: { title: "Live", description: "Shown in search and bookable." },
                            hidden: { title: "Hidden", description: "Kept for your records, not shown to renters." },
                        }}
                    />
                    <Box component="aside" sx={{ ...stickySx, display: "flex", flexDirection: "column", gap: "24px" }}>
                        <ListingPreview draft={draft} />
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {saved && <Notice tone="success" compact>Changes saved. They're live on the site.</Notice>}
                            {dirty && !hasErrors(errors) && <Notice tone="warning" compact>Unsaved changes</Notice>}
                            {submitted && hasErrors(errors) && <Notice tone="danger" role="alert" compact>Check the highlighted fields and try again.</Notice>}
                            {!user && <Notice tone="warning" compact>Sign in as an admin to save changes.</Notice>}
                            {failure && <Notice tone="danger" role="alert" compact>{failure}</Notice>}
                            <Button type="submit" form="edit-listing" variant="contained" size="large" fullWidth disabled={saving || !user}>{saving ? "Saving…" : "Save changes"}</Button>
                            <Button component={RouterLink} to={detailsPath} variant="text" fullWidth>Cancel</Button>
                        </Box>
                        <Box sx={{ p: "20px", border: `1px solid ${colors.dangerSoft}`, borderRadius: radius.lg, display: "flex", flexDirection: "column", gap: "12px" }}>
                            <Typography variant="label" component="span" sx={{ color: colors.danger }}>Delete listing</Typography>
                            {confirmingDelete ? (
                                <Notice
                                    tone="danger"
                                    role="alertdialog"
                                    compact
                                    actions={
                                        <>
                                            <Button variant="contained" color="error" size="small" onClick={onDelete}>Yes, delete</Button>
                                            <Button variant="outlined" size="small" onClick={() => setConfirmingDelete(false)} sx={{ borderColor: colors.borderStrong, color: colors.ink }}>Keep listing</Button>
                                        </>
                                    }
                                >
                                    Delete this listing? This can't be undone.
                                </Notice>
                            ) : (
                                <>
                                    <Typography variant="bodySm" color="text.secondary">Removes it from search. Upcoming bookings must be cancelled first.</Typography>
                                    <Button variant="outlined" color="error" size="large" fullWidth onClick={() => setConfirmingDelete(true)}>Delete listing</Button>
                                </>
                            )}
                        </Box>
                    </Box>
                </PageSection>
            )}
        </>
    )
}

export default EditListing
