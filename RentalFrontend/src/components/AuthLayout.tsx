import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getHeaderDataJsonFile } from "../services/json";
import { colors, layout, radius } from "../theme/tokens";
import { BrandLink } from "./Header";
import PhotoPlaceholder from "./PhotoPlaceholder";

interface AuthLayoutProps {
    photoIcon : ReactNode;
    photoLabel : string;
    headline : string;
    // Copy under the headline in the brand panel
    pitch : ReactNode;
    children : ReactNode;
}

// Split screen for sign in / register: brand panel on the left, form on the right
export default function AuthLayout({ photoIcon, photoLabel, headline, pitch, children }: AuthLayoutProps) {
    return (
        <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
            <Box sx={{ px: layout.pagePaddingX, py: { xs: "24px", lg: "48px" }, background: colors.brandBand, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "32px" }}>
                <BrandLink logoHeight={96} />
                <Box sx={{ display: { xs: "none", lg: "flex" }, flexDirection: "column", gap: "24px" }}>
                    <PhotoPlaceholder icon={photoIcon} label={photoLabel} sx={{ height: 360, borderRadius: radius.xl }} />
                    <Typography variant="displayLg" component="h2">{headline}</Typography>
                    {pitch}
                </Box>
                <Typography variant="bodySm" color="text.secondary" sx={{ display: { xs: "none", lg: "block" } }}>
                    {getHeaderDataJsonFile().tagline}
                </Typography>
            </Box>
            <Box component="main" sx={{ px: { xs: "16px", md: "40px", xl: "120px" }, py: "48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <Box sx={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: "24px" }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
}
