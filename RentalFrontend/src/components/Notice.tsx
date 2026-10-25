import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import { colors, radius } from "../theme/tokens";

type NoticeTone = "success" | "danger" | "warning" | "info";

const tones: Record<NoticeTone, { background: string; color: string }> = {
    success: { background: colors.successSoft, color: colors.success },
    danger: { background: colors.dangerSoft, color: colors.danger },
    warning: { background: colors.warningSoft, color: colors.warning },
    info: { background: colors.surfaceAlt, color: colors.ink },
};

interface NoticeProps {
    tone : NoticeTone;
    title? : ReactNode;
    children? : ReactNode;
    // Buttons or links under the message
    actions? : ReactNode;
    // Short single-line notice (form errors, "Unsaved changes")
    compact? : boolean;
    role? : "status" | "alert" | "alertdialog";
    sx? : SxProps<Theme>;
}

// Soft-coloured message box for success, error and confirmation states
export default function Notice({ tone, title, children, actions, compact = false, role = "status", sx }: NoticeProps) {
    const { background, color } = tones[tone];
    return (
        <Box
            role={role}
            sx={[
                {
                    background,
                    borderRadius: compact ? radius.md : radius.lg,
                    p: compact ? "12px 16px" : "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            {title && <Typography variant="headingSm" component="p" sx={{ color }}>{title}</Typography>}
            {children && (
                <Typography variant={compact ? "label" : "body"} component="div" sx={{ color: compact ? color : colors.ink }}>
                    {children}
                </Typography>
            )}
            {actions && <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px" }}>{actions}</Box>}
        </Box>
    );
}
