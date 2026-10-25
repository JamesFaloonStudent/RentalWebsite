import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import InputBase, { type InputBaseProps } from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import { controlSx } from "../theme/styles";

interface FormFieldProps extends Omit<InputBaseProps, "error" | "id"> {
    id : string;
    label : ReactNode;
    // Shown in red under the field and marks the input invalid
    error? : string | false;
    helper? : ReactNode;
    // Link or control on the label row, e.g. "Forgot password?"
    labelAction? : ReactNode;
}

export default function FormField({ id, label, error, helper, labelAction, multiline, inputProps, sx, ...props }: FormFieldProps) {
    const messageId = `${id}-message`;
    const hasMessage = !!error || !!helper;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
                <Typography component="label" htmlFor={id} variant="label">{label}</Typography>
                {labelAction}
            </Box>
            <InputBase
                id={id}
                error={!!error}
                multiline={multiline}
                inputProps={{ ...inputProps, "aria-invalid": !!error, "aria-describedby": hasMessage ? messageId : undefined }}
                sx={[controlSx(!!error), multiline ? { py: "12px", lineHeight: "24px" } : {}, ...(Array.isArray(sx) ? sx : [sx])]}
                {...props}
            />
            {error ? (
                <Typography id={messageId} variant="bodySm" color="error">{error}</Typography>
            ) : helper ? (
                <Typography id={messageId} variant="bodySm" component="div" color="text.secondary">{helper}</Typography>
            ) : null}
        </Box>
    );
}
