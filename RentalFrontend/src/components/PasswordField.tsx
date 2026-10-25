import { useState, type ReactNode } from "react";
import Button from "@mui/material/Button";
import FormField from "./FormField";

interface PasswordFieldProps {
    id : string;
    label : string;
    autoComplete : "current-password" | "new-password";
    value : string;
    onChange : (value: string) => void;
    error? : string | false;
    helper? : ReactNode;
    // Lets a confirm field share the visibility of the main field
    visible? : boolean;
    onToggleVisible? : () => void;
}

// Password input with a Show/Hide toggle inside the field
export default function PasswordField({ id, label, autoComplete, value, onChange, error, helper, visible, onToggleVisible }: PasswordFieldProps) {
    const [ownVisible, setOwnVisible] = useState(false);
    const shown = visible ?? ownVisible;
    const toggle = onToggleVisible ?? (() => setOwnVisible(!ownVisible));

    return (
        <FormField
            id={id}
            label={label}
            type={shown ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            onChange={event => onChange(event.target.value)}
            error={error}
            helper={helper}
            sx={{ pr: "8px" }}
            endAdornment={
                <Button variant="text" onClick={toggle} aria-label={shown ? "Hide password" : "Show password"} sx={{ minHeight: 40, px: "8px", minWidth: 0 }}>
                    {shown ? "Hide" : "Show"}
                </Button>
            }
        />
    );
}
