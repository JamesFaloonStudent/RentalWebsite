import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { colors, radius } from "../theme/tokens";

interface ChoiceCardProps {
    name : string;
    checked : boolean;
    onChange : () => void;
    title : ReactNode;
    description? : ReactNode;
    // Extra line under the description, e.g. the price
    detail? : ReactNode;
}

// Radio button presented as a selectable card
export default function ChoiceCard({ name, checked, onChange, title, description, detail }: ChoiceCardProps) {
    return (
        <Box
            component="label"
            sx={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                p: "16px",
                borderRadius: radius.lg,
                cursor: "pointer",
                border: checked ? `2px solid ${colors.primaryText}` : `1px solid ${colors.borderStrong}`,
                background: checked ? colors.surfaceAlt : colors.surface,
            }}
        >
            <Box
                component="input"
                type="radio"
                name={name}
                checked={checked}
                onChange={onChange}
                sx={{ width: 20, height: 20, m: "2px 0 0", flexShrink: 0, accentColor: colors.primaryText }}
            />
            <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <Typography variant="body" component="span" sx={{ fontWeight: 600 }}>{title}</Typography>
                {description && <Typography variant="bodySm" component="span" color="text.secondary">{description}</Typography>}
                {detail && <Typography variant="label" component="span">{detail}</Typography>}
            </Box>
        </Box>
    );
}
