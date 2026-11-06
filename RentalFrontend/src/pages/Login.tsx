import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import Notice from "../components/Notice";
import PasswordField from "../components/PasswordField";
import { ArrowRightIcon, BoatIcon } from "../components/Icons";
import { useAuth } from "../context/auth";
import { isValidEmail } from "../services/validation";
import { colors } from "../theme/tokens";
import { navLinkSx } from "../theme/styles";

function Login() {
    const { user, signIn } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [serverError, setServerError] = useState("");
    const [busy, setBusy] = useState(false);

    const emailError = submitted && !isValidEmail(email) && "Enter an email address like name@example.com.";
    const passwordError = submitted && !password && "Enter your password.";


    
    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitted(true);
        setServerError("");
        if (!isValidEmail(email) || !password) {
            return;
        }

        setBusy(true);
        try {
            await signIn(email.trim(), password);
        } catch (error) {
            setServerError(error instanceof Error ? error.message : "We couldn't sign you in.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthLayout
            photoIcon={<BoatIcon size={72} strokeWidth={1.1} />}
            photoLabel="Brand photo: boat at the dock"
            headline="Your weekend starts at the dock."
            pitch={<Typography variant="bodyLg" color="text.secondary" sx={{ maxWidth: 480 }}>Sign in to book faster and keep track of every boat and trailer you rent.</Typography>}
        >
            {user ? (
                <Notice
                    tone="success"
                    title="You're signed in"
                    actions={
                        <>
                            <Button component={RouterLink} to="/" variant="contained">Browse rentals</Button>
                            <Link component={RouterLink} to="/my-rentals" underline="none" sx={navLinkSx}>View my rentals</Link>
                        </>
                    }
                >
                    Welcome back, {user.email}.
                </Notice>
            ) : (
                <>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <Typography variant="headingLg" component="h1">Sign in</Typography>
                        <Typography variant="body" color="text.secondary">
                            New here? <Link component={RouterLink} to="/register" underline="always" sx={{ fontWeight: 600 }}>Create an account</Link>
                        </Typography>
                    </Box>

                    <Box component="form" noValidate onSubmit={onSubmit} sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {(serverError || (submitted && (emailError || passwordError))) && (
                            <Notice tone="danger" role="alert" compact>
                                {serverError || "Check the highlighted fields and try again."}
                            </Notice>
                        )}
                        <FormField
                            id="login-email"
                            label="Email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            error={emailError}
                        />
                        <PasswordField
                            id="login-password"
                            label="Password"
                            autoComplete="current-password"
                            value={password}
                            onChange={setPassword}
                            error={passwordError}
                        />
                        <Button type="submit" variant="contained" size="large" disabled={busy}>
                            {busy ? "Signing in…" : "Sign in"}
                        </Button>
                    </Box>

                    <Box sx={{ pt: "24px", borderTop: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center" }}>
                        <Link component={RouterLink} to="/" underline="none" sx={{ ...navLinkSx, fontSize: "16px" }}>
                            Skip for now and browse available rentals
                            <ArrowRightIcon />
                        </Link>
                        <Typography variant="bodySm" color="text.secondary">You'll be asked to sign in when you reserve.</Typography>
                    </Box>
                </>
            )}
        </AuthLayout>
    )
}

export default Login
