import type { ReactNode } from "react";
import Typography from "@mui/material/Typography";
import { getHeaderDataJsonFile } from "../services/json";
import { colors, fonts } from "../theme/tokens";
import PageSection from "./PageSection";

export default function Footer({ note }: { note?: ReactNode }) {
    const headerData = getHeaderDataJsonFile();
    return (
        <PageSection
            component="footer"
            outerSx={{ background: colors.primary }}
            sx={{ py: "32px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px 24px" }}
        >
            <Typography component="span" sx={{ fontFamily: fonts.display, fontWeight: 700, fontSize: "22px", color: colors.onPrimary }}>
                {headerData.title}
            </Typography>
            <Typography variant="bodySm" component="span" sx={{ color: colors.footerMuted }}>
                {note ?? headerData.tagline}
            </Typography>
        </PageSection>
    );
}
