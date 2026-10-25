import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { colors, typeScale } from "../theme/tokens";

interface PhotoPlaceholderProps {
    icon? : ReactNode;
    label? : ReactNode;
    sx? : SxProps<Theme>;
}

// Sunken box standing in for a photo until real images exist
export default function PhotoPlaceholder({ icon, label, sx }: PhotoPlaceholderProps) {
    return (
        <Box
            sx={[
                {
                    ...typeScale.caption,
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    background: colors.surfaceSunken,
                    color: colors.inkMuted,
                    textAlign: "center",
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            {icon}
            {label}
        </Box>
    );
}
