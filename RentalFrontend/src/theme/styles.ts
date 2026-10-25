import { colors, layout, radius, shadows } from "./tokens";

// Reusable sx snippets built from the tokens

export const navLinkSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: layout.touchTarget,
    fontSize: "14px",
    fontWeight: 600,
} as const;

export const cardSx = {
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    background: colors.surface,
} as const;

export const raisedCardSx = { ...cardSx, boxShadow: shadows.sm } as const;

export const stickySx = { position: { lg: "sticky" }, top: { lg: "24px" } } as const;

// Main column + fixed-width aside on desktop, stacked below lg
export function twoColumnSx(asideWidth: number) {
    return {
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: `minmax(0, 1fr) ${asideWidth}px` },
        gap: "48px",
        alignItems: "start",
    } as const;
}

export function controlBorder(hasError: boolean) {
    return hasError ? `2px solid ${colors.danger}` : `1px solid ${colors.borderStrong}`;
}

// Bordered text-control shell; inputs inside it inherit the font
export function controlSx(hasError = false) {
    return {
        boxSizing: "border-box",
        minHeight: layout.controlHeight,
        px: "16px",
        border: controlBorder(hasError),
        borderRadius: radius.md,
        background: colors.surface,
        fontSize: "16px",
        color: colors.ink,
        "&.Mui-focused": { outline: `2px solid ${colors.focusRing}`, outlineOffset: "2px" },
    } as const;
}
