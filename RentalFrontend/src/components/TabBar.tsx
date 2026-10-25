import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { colors, layout, radius, shadows, typeScale } from "../theme/tokens";

export interface TabBarOption<T extends string> {
    value : T;
    label : string;
    icon? : ReactNode;
}

interface TabBarProps<T extends string> {
    label : string;
    options : TabBarOption<T>[];
    // null when nothing is selected (e.g. while showing search results)
    value : T | null;
    onChange : (value: T) => void;
}

// Pill-shaped segmented control (Boats / Trailers)
export default function TabBar<T extends string>({ label, options, value, onChange }: TabBarProps<T>) {
    return (
        <Box role="group" aria-label={label} sx={{ display: "inline-flex", gap: "4px", p: "4px", background: colors.surfaceSunken, borderRadius: radius.pill }}>
            {options.map(option => {
                const selected = option.value === value;
                return (
                    <ButtonBase
                        key={option.value}
                        aria-pressed={selected}
                        onClick={() => onChange(option.value)}
                        sx={{
                            ...typeScale.label,
                            gap: "8px",
                            height: layout.touchTarget,
                            px: "20px",
                            borderRadius: radius.pill,
                            transition: "background-color 150ms ease-out",
                            ...(selected
                                ? { background: colors.primary, color: colors.onPrimary, boxShadow: shadows.sm }
                                : { background: "transparent", color: colors.ink }),
                        }}
                    >
                        {option.icon}
                        {option.label}
                    </ButtonBase>
                );
            })}
        </Box>
    );
}
