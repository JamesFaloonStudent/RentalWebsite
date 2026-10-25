import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { colors } from "../theme/tokens";
import PageSection from "./PageSection";

interface PageBandProps {
    title : ReactNode;
    subtitle? : ReactNode;
    // Breadcrumb or other line above the title
    above? : ReactNode;
    // Badges or actions beside the title
    titleAside? : ReactNode;
    // Tabs or other content at the bottom of the band
    children? : ReactNode;
    size? : "hero" | "page";
}

// Pale brand band that carries the page title
export default function PageBand({ title, subtitle, above, titleAside, children, size = "page" }: PageBandProps) {
    const isHero = size === "hero";
    return (
        <PageSection
            component="section"
            outerSx={{ background: colors.brandBand }}
            sx={{
                pt: isHero ? "64px" : "40px",
                pb: children ? 0 : isHero ? "64px" : "32px",
                display: "flex",
                flexDirection: "column",
                gap: isHero ? "16px" : "8px",
            }}
        >
            {above}
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
                <Typography variant={isHero ? "displayXl" : "displayLg"} sx={isHero ? { fontSize: { xs: "40px", md: "56px" }, lineHeight: { xs: "44px", md: "60px" } } : undefined}>
                    {title}
                </Typography>
                {titleAside}
            </Box>
            {subtitle && (
                <Typography variant={isHero ? "bodyLg" : "body"} color="text.secondary" sx={{ maxWidth: isHero ? 640 : undefined }}>
                    {subtitle}
                </Typography>
            )}
            {children && <Box sx={{ mt: "16px" }}>{children}</Box>}
        </PageSection>
    );
}
