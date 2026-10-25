import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { Category } from "../models/Listing";
import { colors } from "../theme/tokens";
import { raisedCardSx } from "../theme/styles";
import Badge from "./Badge";
import { CategoryIcon } from "./Icons";
import PhotoPlaceholder from "./PhotoPlaceholder";

interface ListingCardProps {
    id? : string;
    category : Category;
    name : string;
    type : string;
    description : string;
    price : string;
    showEdit? : boolean;
    // Live preview in the admin forms: 16:9 cover, no links or actions
    preview? : boolean;
}

export default function ListingCard({ id, category, name, type, description, price, showEdit = false, preview = false }: ListingCardProps) {
    const detailsPath = `/listings/${id}`;

    return (
        <Box component="article" sx={{ ...raisedCardSx, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {preview ? (
                <PhotoPlaceholder label="Cover photo" sx={{ aspectRatio: "16 / 9" }} />
            ) : (
                <PhotoPlaceholder icon={<CategoryIcon category={category} size={64} strokeWidth={1.25} />} sx={{ aspectRatio: "4 / 3" }} />
            )}
            <Box sx={{ flexGrow: 1, p: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <Badge tone="brand">{type}</Badge>
                <Typography variant="headingSm" component="h3">
                    {preview ? name : (
                        <Link component={RouterLink} to={detailsPath} underline="hover" sx={{ color: colors.ink }}>{name}</Link>
                    )}
                </Typography>
                <Typography variant="bodySm" color="text.secondary">{description}</Typography>
            </Box>
            <Box sx={{ px: "20px", py: "16px", borderTop: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <Typography component="p" sx={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <Typography variant="price" component="span">{price}</Typography>
                    <Typography variant="bodySm" component="span" color="text.secondary">/ day</Typography>
                </Typography>
                {!preview && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {showEdit && (
                            <Button component={RouterLink} to={`${detailsPath}/edit`} variant="text" size="small" sx={{ px: "12px" }}>Edit</Button>
                        )}
                        <Button component={RouterLink} to={detailsPath} variant="outlined" size="small" sx={{ px: "20px" }}>View details</Button>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
