import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { colors, layout, radius, typeScale } from "../theme/tokens";

interface ChipGroupProps<T extends string | number> {
    options : { value: T; label: string }[];
    value : T | null;
    onChange : (value: T) => void;
    // Accessible name when the chips aren't inside a labelled fieldset
    label? : string;
}

// Row of toggle chips where one can be selected
export default function ChipGroup<T extends string | number>({ options, value, onChange, label }: ChipGroupProps<T>) {
    return (
        <Box role={label ? "group" : undefined} aria-label={label} sx={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {options.map(option => {
                const selected = option.value === value;
                return (
                    <ButtonBase
                        key={option.value}
                        aria-pressed={selected}
                        onClick={() => onChange(option.value)}
                        sx={{
                            ...typeScale.label,
                            height: layout.touchTarget,
                            px: "16px",
                            borderRadius: radius.pill,
                            color: colors.ink,
                            border: `1px solid ${selected ? colors.primary : colors.borderStrong}`,
                            background: selected ? colors.primarySoft : colors.surface,
                        }}
                    >
                        {option.label}
                    </ButtonBase>
                );
            })}
        </Box>
    );
}
