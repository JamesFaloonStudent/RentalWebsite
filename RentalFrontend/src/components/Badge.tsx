import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { colors, radius, typeScale } from "../theme/tokens";

export type BadgeTone = "brand" | "neutral" | "success" | "warning" | "danger" | "onPhoto";

const toneColors: Record<BadgeTone, { background: string; color: string }> = {
    brand: { background: colors.primarySoft, color: colors.ink },
    neutral: { background: colors.surfaceSunken, color: colors.ink },
    success: { background: colors.successSoft, color: colors.success },
    warning: { background: colors.warningSoft, color: colors.warning },
    danger: { background: colors.dangerSoft, color: colors.danger },
    onPhoto: { background: colors.surface, color: colors.inkMuted },
};

interface BadgeProps {
    tone? : BadgeTone;
    icon? : ReactNode;
    children : ReactNode;
}

export default function Badge({ tone = "brand", icon, children }: BadgeProps) {
    return (
        <Box
            component="span"
            sx={{
                ...typeScale.caption,
                ...toneColors[tone],
                display: "inline-flex",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: radius.sm,
                fontWeight: tone === "onPhoto" ? 500 : 600,
                whiteSpace: "nowrap",
            }}
        >
            {icon}
            {children}
        </Box>
    );
}
