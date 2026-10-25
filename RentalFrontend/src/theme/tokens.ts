// Harbor & Hitch design system: the single source for colours, fonts and sizes.
// Change a value here and every page picks it up (theme.ts builds the MUI theme from these).

// Raw brand palette, taken from the logo
export const brand = {
    navy: "#041e42",
    slate: "#21436a",
    blue: "#3b6ea5",
    medium: "#5182b1",
    sky: "#6dbaf4",
    steel: "#abbcce",
    white: "#ffffff",
} as const;

// Semantic colours: use these in components rather than the raw palette
export const colors = {
    surface: brand.white, // page background, card fill
    surfaceAlt: "#f3f6fa", // alternating sections, empty states, selected radio cards
    surfaceSunken: "#e8eef5", // input wells, segmented-control track, photo placeholders
    border: brand.steel, // hairline dividers and card outlines
    borderStrong: brand.medium, // form control borders
    ink: brand.navy, // primary text and headings
    inkMuted: brand.slate, // secondary text, meta rows, helper text
    primary: brand.navy, // primary buttons, selected segment, footer band
    primaryHover: brand.slate,
    onPrimary: brand.white, // text on primary fills
    primaryText: brand.blue, // links, outlined/text button labels
    primarySoft: "#e3f1fd", // selected chips, brand badges
    brandBand: "#eaf0f6", // hero and page-title band
    accent: brand.sky, // sparing highlight fill, always with onAccent text
    onAccent: brand.navy,
    success: "#0e7a5a",
    successSoft: "#dcf5ec",
    warning: "#9a5a06",
    warningSoft: "#fdf0d5",
    danger: "#b42318",
    dangerSoft: "#fde4e1",
    focusRing: brand.blue,
    footerMuted: brand.steel, // secondary text on the navy footer
} as const;

// Loaded from Google Fonts in index.html
export const fonts = {
    display: '"Bricolage Grotesque", "Figtree", system-ui, sans-serif',
    sans: '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
} as const;

interface TypeStyle {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    fontWeight: number;
    letterSpacing?: string;
    fontVariantNumeric?: string;
}

// Type scale; each entry is also a <Typography variant="..."> in the MUI theme
export const typeScale = {
    displayXl: { fontFamily: fonts.display, fontSize: "56px", lineHeight: "60px", fontWeight: 700, letterSpacing: "-0.02em" }, // homepage hero
    displayLg: { fontFamily: fonts.display, fontSize: "40px", lineHeight: "44px", fontWeight: 700, letterSpacing: "-0.015em" }, // page titles
    headingLg: { fontFamily: fonts.display, fontSize: "28px", lineHeight: "34px", fontWeight: 600, letterSpacing: "-0.01em" }, // section headings
    headingMd: { fontFamily: fonts.display, fontSize: "22px", lineHeight: "28px", fontWeight: 600 }, // card group headings
    headingSm: { fontFamily: fonts.sans, fontSize: "18px", lineHeight: "24px", fontWeight: 600 }, // listing card titles
    bodyLg: { fontFamily: fonts.sans, fontSize: "18px", lineHeight: "28px", fontWeight: 400 },
    body: { fontFamily: fonts.sans, fontSize: "16px", lineHeight: "24px", fontWeight: 400 },
    bodySm: { fontFamily: fonts.sans, fontSize: "14px", lineHeight: "20px", fontWeight: 400 },
    label: { fontFamily: fonts.sans, fontSize: "14px", lineHeight: "20px", fontWeight: 600 }, // buttons, field labels, tabs
    caption: { fontFamily: fonts.sans, fontSize: "12px", lineHeight: "16px", fontWeight: 500, letterSpacing: "0.02em" }, // badges
    price: { fontFamily: fonts.sans, fontSize: "24px", lineHeight: "28px", fontWeight: 700, fontVariantNumeric: "tabular-nums" },
    code: { fontFamily: fonts.mono, fontSize: "13px", lineHeight: "20px", fontWeight: 500 }, // booking references
} as const satisfies Record<string, TypeStyle>;

export const radius = {
    sm: "6px", // badges, checkboxes
    md: "10px", // buttons, inputs
    lg: "16px", // cards, photos, alerts
    xl: "24px", // hero media
    pill: "999px", // segmented control, chips, avatar
} as const;

export const shadows = {
    sm: "0 1px 2px rgba(4, 30, 66, 0.06), 0 1px 3px rgba(4, 30, 66, 0.08)", // resting cards
    md: "0 4px 12px rgba(4, 30, 66, 0.10), 0 2px 4px rgba(4, 30, 66, 0.06)", // sticky summaries, hovered cards
    lg: "0 16px 40px rgba(4, 30, 66, 0.18)", // modals
} as const;

// px; MUI breakpoints use these values
export const breakpoints = {
    xs: 0,
    sm: 640, // 2-up listing grid
    md: 768, // tablet
    lg: 1024, // desktop: 3-up grid, side-by-side summaries
    xl: 1280, // max content width
} as const;

export const layout = {
    maxContentWidth: breakpoints.xl,
    pagePaddingX: { xs: "16px", md: "40px", lg: "80px" },
    headerHeight: "80px",
    controlHeight: "48px",
    touchTarget: "44px",
} as const;
