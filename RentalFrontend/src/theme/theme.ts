import type { CSSProperties } from "react";
import { createTheme } from "@mui/material/styles";
import { breakpoints, colors, fonts, radius, typeScale } from "./tokens";

// Registers the typeScale names as <Typography variant="..."> values (MUI already has `caption`)
declare module "@mui/material/styles" {
    interface TypographyVariants {
        displayXl: CSSProperties;
        displayLg: CSSProperties;
        headingLg: CSSProperties;
        headingMd: CSSProperties;
        headingSm: CSSProperties;
        bodyLg: CSSProperties;
        body: CSSProperties;
        bodySm: CSSProperties;
        label: CSSProperties;
        price: CSSProperties;
        code: CSSProperties;
    }
    interface TypographyVariantsOptions {
        displayXl?: CSSProperties;
        displayLg?: CSSProperties;
        headingLg?: CSSProperties;
        headingMd?: CSSProperties;
        headingSm?: CSSProperties;
        bodyLg?: CSSProperties;
        body?: CSSProperties;
        bodySm?: CSSProperties;
        label?: CSSProperties;
        price?: CSSProperties;
        code?: CSSProperties;
    }
}

declare module "@mui/material/Typography" {
    interface TypographyPropsVariantOverrides {
        displayXl: true;
        displayLg: true;
        headingLg: true;
        headingMd: true;
        headingSm: true;
        bodyLg: true;
        body: true;
        bodySm: true;
        label: true;
        price: true;
        code: true;
    }
}

export const theme = createTheme({
    breakpoints: { values: breakpoints },
    palette: {
        primary: { main: colors.primary, dark: colors.primaryHover, contrastText: colors.onPrimary },
        secondary: { main: colors.primaryText, contrastText: colors.onPrimary },
        error: { main: colors.danger, light: colors.dangerSoft, contrastText: colors.onPrimary },
        success: { main: colors.success, light: colors.successSoft },
        warning: { main: colors.warning, light: colors.warningSoft },
        text: { primary: colors.ink, secondary: colors.inkMuted },
        background: { default: colors.surface, paper: colors.surface },
        divider: colors.border,
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: fonts.sans,
        ...typeScale,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: colors.surface, color: colors.ink, fontFamily: fonts.sans },
                ":focus-visible": { outline: `2px solid ${colors.focusRing}`, outlineOffset: "2px" },
                "input::placeholder, textarea::placeholder": { color: colors.inkMuted, opacity: 1 },
            },
        },
        MuiTypography: {
            defaultProps: {
                variantMapping: {
                    displayXl: "h1",
                    displayLg: "h1",
                    headingLg: "h2",
                    headingMd: "h2",
                    headingSm: "h3",
                    bodyLg: "p",
                    body: "p",
                    bodySm: "p",
                    label: "span",
                    price: "span",
                    code: "span",
                },
            },
            styleOverrides: { root: { margin: 0 } },
        },
        MuiButtonBase: {
            defaultProps: { disableRipple: true },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: {
                    ...typeScale.label,
                    minHeight: "48px",
                    padding: "0 20px",
                    borderRadius: radius.md,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                },
                sizeSmall: { minHeight: "44px", padding: "0 16px" },
                sizeLarge: { fontSize: "16px" },
            },
            variants: [
                {
                    props: { variant: "contained", color: "primary" },
                    style: { "&:hover": { backgroundColor: colors.primaryHover } },
                },
                {
                    props: { variant: "outlined", color: "primary" },
                    style: {
                        borderColor: colors.primaryText,
                        color: colors.primaryText,
                        backgroundColor: colors.surface,
                        "&:hover": { borderColor: colors.primaryText, backgroundColor: colors.surfaceAlt },
                    },
                },
                {
                    props: { variant: "outlined", color: "error" },
                    style: {
                        borderColor: colors.danger,
                        backgroundColor: colors.surface,
                        "&:hover": { backgroundColor: colors.dangerSoft },
                    },
                },
                {
                    props: { variant: "text", color: "primary" },
                    style: {
                        color: colors.primaryText,
                        "&:hover": { backgroundColor: "transparent", color: colors.ink },
                    },
                },
                {
                    props: { variant: "text", color: "error" },
                    style: { "&:hover": { backgroundColor: "transparent", textDecoration: "underline" } },
                },
            ],
        },
        MuiLink: {
            defaultProps: { underline: "hover" },
            styleOverrides: {
                root: {
                    color: colors.primaryText,
                    "&:hover": { color: colors.ink },
                },
            },
        },
    },
});
