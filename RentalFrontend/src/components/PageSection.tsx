import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { layout } from "../theme/tokens";

interface PageSectionProps {
    children : ReactNode;
    component? : "div" | "section" | "main" | "header" | "footer";
    // Applied to the full-width band
    outerSx? : SxProps<Theme>;
    // Applied to the centred inner column
    sx? : SxProps<Theme>;
}

function toArray(sx: SxProps<Theme> | undefined) {
    return Array.isArray(sx) ? sx : [sx];
}

// Full-width band with the page gutter and a centred column capped at the max content width
export default function PageSection({ children, component = "div", outerSx, sx }: PageSectionProps) {
    return (
        <Box component={component} sx={[{ px: layout.pagePaddingX }, ...toArray(outerSx)]}>
            <Box sx={[{ maxWidth: layout.maxContentWidth, mx: "auto" }, ...toArray(sx)]}>
                {children}
            </Box>
        </Box>
    );
}
