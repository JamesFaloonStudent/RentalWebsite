import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Header, { BackLink } from "../components/Header";
import PageBand from "../components/PageBand";
import PageSection from "../components/PageSection";
import Notice from "../components/Notice";
import ListingForm, { ListingPreview } from "../components/ListingForm";
import type { ListingDraft } from "../models/Listing";
import { formatMoney } from "../services/format";
import { hasErrors, listingDraftErrors } from "../services/validation";
import { stickySx, twoColumnSx } from "../theme/styles";

const emptyDraft: ListingDraft = {
    category: "boats", name: "", type: "", description: "", price: "",
    capacity: "", lengthFt: "", deckSize: "", hitch: "", visible: true,
};

function AddListing() {
    const [draft, setDraft] = useState(emptyDraft);
    const [submitted, setSubmitted] = useState(false);
    const [published, setPublished] = useState(false);
    const errors = listingDraftErrors(draft);

    function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitted(true);
        if (!hasErrors(errors)) {
            setPublished(true);
        }
    }

    function addAnother() {
        setDraft({ ...emptyDraft, category: draft.category });
        setSubmitted(false);
        setPublished(false);
    }

    return (
        <>
            <Header>
                <BackLink>Back to listings</BackLink>
            </Header>

            <PageBand
                above={<Typography component="nav" aria-label="Breadcrumb" variant="bodySm" color="text.secondary"><Link component={RouterLink} to="/">Listings</Link> / New</Typography>}
                title="Add a listing"
                subtitle="Add a boat or trailer. You can edit any of this later."
            />

            {published ? (
                <PageSection sx={{ py: "64px" }}>
                    <Notice
                        tone="success"
                        title={draft.visible ? "Listing published" : "Listing saved as hidden"}
                        sx={{ maxWidth: 640 }}
                        actions={
                            <>
                                <Button component={RouterLink} to="/" variant="contained">View listings</Button>
                                <Button variant="text" onClick={addAnother}>Add another</Button>
                            </>
                        }
                    >
                        {draft.visible
                            ? `${draft.name.trim()} is now live in search at ${formatMoney(Number(draft.price))} / day.`
                            : `${draft.name.trim()} is saved. Publish it from the edit page when it is ready.`}
                    </Notice>
                </PageSection>
            ) : (
                <PageSection sx={{ py: "48px", ...twoColumnSx(400) }}>
                    <ListingForm
                        id="new-listing"
                        variant="add"
                        draft={draft}
                        onChange={setDraft}
                        onSubmit={onSubmit}
                        errors={errors}
                        showErrors={submitted}
                        visibility={{
                            live: { title: "Publish now", description: "Shown in search and bookable straight away." },
                            hidden: { title: "Save as hidden", description: "Finish it later; renters won't see it yet." },
                        }}
                    />
                    <Box component="aside" sx={{ ...stickySx, display: "flex", flexDirection: "column", gap: "24px" }}>
                        <ListingPreview draft={draft} />
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {submitted && hasErrors(errors) && (
                                <Notice tone="danger" role="alert" compact>Check the highlighted fields and try again.</Notice>
                            )}
                            <Button type="submit" form="new-listing" variant="contained" size="large" fullWidth>
                                {draft.visible ? "Publish listing" : "Save as hidden"}
                            </Button>
                            <Button component={RouterLink} to="/" variant="text" fullWidth>Cancel</Button>
                        </Box>
                    </Box>
                </PageSection>
            )}
        </>
    )
}

export default AddListing
