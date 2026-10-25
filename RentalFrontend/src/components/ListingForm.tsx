import type { FormEvent, ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { Category, ListingDraft } from "../models/Listing";
import { formatMoney } from "../services/format";
import { colors, radius, typeScale } from "../theme/tokens";
import ChoiceCard from "./ChoiceCard";
import FormField from "./FormField";
import ListingCard from "./ListingCard";
import PhotoPlaceholder from "./PhotoPlaceholder";
import SectionCard from "./SectionCard";
import TabBar from "./TabBar";
import { CategoryIcon, PlusIcon, UploadIcon } from "./Icons";

interface VisibilityCopy {
    title : string;
    description : string;
}

interface ListingFormProps {
    id : string;
    draft : ListingDraft;
    onChange : (draft: ListingDraft) => void;
    onSubmit : (event: FormEvent) => void;
    errors : { name: string; price: string };
    // Errors only show after the first submit attempt
    showErrors : boolean;
    variant : "add" | "edit";
    visibility : { live: VisibilityCopy; hidden: VisibilityCopy };
}

const categories: { value: Category; label: string }[] = [
    { value: "boats", label: "Boat" },
    { value: "trailers", label: "Trailer" },
];

const twoUp = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: "16px 24px" } as const;

export default function ListingForm({ id, draft, onChange, onSubmit, errors, showErrors, variant, visibility }: ListingFormProps) {
    const isBoat = draft.category === "boats";

    function set<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) {
        onChange({ ...draft, [key]: value });
    }

    const typeField = (
        <FormField
            id={`${id}-type`}
            label="Type"
            value={draft.type}
            onChange={event => set("type", event.target.value)}
            placeholder={variant === "edit" ? "Pontoon, bowrider, enclosed…" : isBoat ? "Pontoon, bowrider…" : "Enclosed, utility…"}
        />
    );

    return (
        <Box component="form" id={id} noValidate onSubmit={onSubmit} sx={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <SectionCard title="Basics">
                {variant === "add" && (
                    <Box component="fieldset" sx={fieldsetSx}>
                        <Typography component="legend" variant="label" sx={{ mb: "8px" }}>What are you listing?</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
                            {categories.map(option => {
                                const selected = option.value === draft.category;
                                return (
                                    <ButtonBase
                                        key={option.value}
                                        aria-pressed={selected}
                                        onClick={() => set("category", option.value)}
                                        sx={{
                                            ...typeScale.headingSm,
                                            gap: "12px",
                                            justifyContent: "flex-start",
                                            p: "16px 20px",
                                            borderRadius: radius.lg,
                                            color: colors.ink,
                                            border: selected ? `2px solid ${colors.primaryText}` : `1px solid ${colors.borderStrong}`,
                                            background: selected ? colors.primarySoft : colors.surface,
                                        }}
                                    >
                                        <CategoryIcon category={option.value} size={28} />
                                        {option.label}
                                    </ButtonBase>
                                );
                            })}
                        </Box>
                    </Box>
                )}
                {variant === "add" ? (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "2fr 1fr" }, gap: "16px 24px" }}>
                        <FormField
                            id={`${id}-name`}
                            label="Listing name"
                            value={draft.name}
                            onChange={event => set("name", event.target.value)}
                            placeholder={isBoat ? "e.g. 2021 Sea Ray SPX 210" : "e.g. 6×12 ft enclosed cargo trailer"}
                            error={showErrors && errors.name}
                        />
                        {typeField}
                    </Box>
                ) : (
                    <>
                        <FormField id={`${id}-name`} label="Listing name" value={draft.name} onChange={event => set("name", event.target.value)} error={showErrors && errors.name} />
                        <Box sx={twoUp}>
                            <Box component="fieldset" sx={fieldsetSx}>
                                <Typography component="legend" variant="label" sx={{ mb: "8px" }}>Category</Typography>
                                <TabBar label="Category" options={categories} value={draft.category} onChange={value => set("category", value)} />
                            </Box>
                            {typeField}
                        </Box>
                    </>
                )}
                <FormField
                    id={`${id}-description`}
                    label="Description"
                    multiline
                    minRows={4}
                    value={draft.description}
                    onChange={event => set("description", event.target.value)}
                    placeholder={variant === "add" ? "What's it good for, and what's included?" : undefined}
                    helper={variant === "edit" ? "Shown on the listing card and the details page." : undefined}
                />
            </SectionCard>

            <SectionCard title="Pricing and specs">
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }, gap: "16px 24px" }}>
                    <FormField
                        id={`${id}-price`}
                        label="Price per day"
                        type="number"
                        value={draft.price}
                        onChange={event => set("price", event.target.value)}
                        inputProps={{ min: 1, step: 1, inputMode: "numeric" }}
                        startAdornment={<Adornment>$</Adornment>}
                        endAdornment={<Adornment>/ day</Adornment>}
                        error={showErrors && errors.price}
                    />
                    {isBoat ? (
                        <>
                            <FormField id={`${id}-capacity`} label="Capacity (guests)" type="number" inputProps={{ min: 1 }} value={draft.capacity} onChange={event => set("capacity", event.target.value)} />
                            <FormField id={`${id}-length`} label="Length (ft)" type="number" inputProps={{ min: 1 }} value={draft.lengthFt} onChange={event => set("lengthFt", event.target.value)} />
                        </>
                    ) : (
                        <>
                            <FormField id={`${id}-deck`} label="Deck size" placeholder="6×12 ft" value={draft.deckSize} onChange={event => set("deckSize", event.target.value)} />
                            <FormField id={`${id}-hitch`} label="Hitch" placeholder={'7-pin, 2-5/16" ball'} value={draft.hitch} onChange={event => set("hitch", event.target.value)} />
                        </>
                    )}
                </Box>
            </SectionCard>

            <SectionCard title="Photos">
                {variant === "add" ? (
                    <Box component="label" sx={{ ...dropzoneSx, height: 180, gap: "8px" }}>
                        <Box component="span" sx={{ display: "flex", color: colors.primaryText }}><UploadIcon size={28} /></Box>
                        <Typography variant="label" component="span" sx={{ color: colors.primaryText }}>Upload photos</Typography>
                        <Typography variant="bodySm" component="span" color="text.secondary">Drag files here or browse. JPG or PNG, landscape, daylight.</Typography>
                        <Box component="input" type="file" accept="image/jpeg,image/png" multiple sx={hiddenFileInputSx} />
                    </Box>
                ) : (
                    <>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: "16px" }}>
                            {["Cover photo", "Photo 2", "Photo 3"].map(label => (
                                <PhotoPlaceholder key={label} label={label} sx={{ aspectRatio: "4 / 3", borderRadius: radius.lg }} />
                            ))}
                            <Box component="label" sx={{ ...dropzoneSx, aspectRatio: "4 / 3", gap: "4px", color: colors.primaryText, ...typeScale.label }}>
                                <PlusIcon />
                                Add photos
                                <Box component="input" type="file" accept="image/jpeg,image/png" multiple sx={hiddenFileInputSx} />
                            </Box>
                        </Box>
                        <Typography variant="bodySm" color="text.secondary">Daylight photos of the actual rental. The first photo is the cover on cards.</Typography>
                    </>
                )}
            </SectionCard>

            <SectionCard title="Visibility">
                <Box sx={twoUp}>
                    <ChoiceCard name={`${id}-visibility`} checked={draft.visible} onChange={() => set("visible", true)} title={visibility.live.title} description={visibility.live.description} />
                    <ChoiceCard name={`${id}-visibility`} checked={!draft.visible} onChange={() => set("visible", false)} title={visibility.hidden.title} description={visibility.hidden.description} />
                </Box>
            </SectionCard>
        </Box>
    );
}

// Live card preview for the admin forms' sidebar
export function ListingPreview({ draft }: { draft: ListingDraft }) {
    const price = Number(draft.price);
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Typography variant="label" component="span" color="text.secondary">Card preview</Typography>
            <ListingCard
                preview
                category={draft.category}
                name={draft.name.trim() || "Listing name"}
                type={draft.type.trim() || (draft.category === "boats" ? "Boat" : "Trailer")}
                description={draft.description.trim() || "Your description appears here."}
                price={price > 0 ? formatMoney(price) : "$—"}
            />
        </Box>
    );
}

function Adornment({ children }: { children: ReactNode }) {
    return <Box component="span" sx={{ ...typeScale.body, color: colors.inkMuted, whiteSpace: "nowrap", px: "4px" }}>{children}</Box>;
}

const fieldsetSx = { m: 0, p: 0, border: 0, minWidth: 0 } as const;

const dropzoneSx = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    p: "16px",
    border: `1px dashed ${colors.borderStrong}`,
    borderRadius: radius.lg,
    background: colors.surfaceAlt,
    cursor: "pointer",
    "&:focus-within": { outline: `2px solid ${colors.focusRing}`, outlineOffset: "2px" },
} as const;

// Keeps the native file input focusable and clickable across the whole drop zone
const hiddenFileInputSx = { position: "absolute", inset: 0, opacity: 0, cursor: "pointer" } as const;
