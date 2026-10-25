import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import { getHeaderDataJsonFile } from "../services/json";
import { useAuth } from "../context/auth";
import { colors, fonts, layout } from "../theme/tokens";
import { navLinkSx } from "../theme/styles";
import Badge from "./Badge";
import PageSection from "./PageSection";
import { ChevronLeftIcon } from "./Icons";

export function BrandLink({ logoHeight = 64 }: { logoHeight?: number }) {
    const headerData = getHeaderDataJsonFile();
    return (
        <Link
            component={RouterLink}
            to="/"
            underline="none"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: { xs: "18px", md: "24px" },
                color: colors.ink,
                "&:hover": { color: colors.ink },
            }}
        >
            <Box component="img" src={headerData.logoPath} alt="" sx={{ height: { xs: 48, md: logoHeight }, width: "auto", display: "block" }} />
            {headerData.title}
        </Link>
    );
}

export function BackLink({ to = "/", children = "Back to rentals" }: { to?: string; children?: ReactNode }) {
    return (
        <Link component={RouterLink} to={to} underline="none" sx={navLinkSx}>
            <ChevronLeftIcon />
            {children}
        </Link>
    );
}

// Site header bar: brand on the left, page-specific content (back link, nav, search) after it
export default function Header({ children }: { children?: ReactNode }) {
    const { user } = useAuth();

    return (
        <PageSection
            component="header"
            outerSx={{ borderBottom: `1px solid ${colors.border}` }}
            sx={{
                minHeight: layout.headerHeight,
                py: { xs: "12px", lg: 0 },
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px 24px",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <BrandLink />
                {user?.isAdmin && <Badge tone="brand">Admin</Badge>}
            </Box>
            {children}
        </PageSection>
    );
}
