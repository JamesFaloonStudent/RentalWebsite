import { useId, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { cardSx } from "../theme/styles";

// Bordered form section with a heading
export default function SectionCard({ title, children }: { title: ReactNode; children: ReactNode }) {
    const headingId = useId();
    return (
        <Box component="section" aria-labelledby={headingId} sx={{ ...cardSx, p: { xs: "16px", md: "24px" }, display: "flex", flexDirection: "column", gap: "20px" }}>
            <Typography id={headingId} variant="headingMd">{title}</Typography>
            {children}
        </Box>
    );
}
