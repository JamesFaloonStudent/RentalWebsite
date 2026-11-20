import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import AuthLayout from "../components/AuthLayout";
import GoogleSignInButton from "../components/GoogleSignInButton";
import Notice from "../components/Notice";
import { ArrowRightIcon, BoatIcon } from "../components/Icons";
import { useAuth } from "../context/auth";
import { googleClientId } from "../services/google";
import { colors } from "../theme/tokens";
import { navLinkSx } from "../theme/styles";

function Login() {
    const { user, signIn } = useAuth();
    const [serverError, setServerError] = useState("");
    const [busy, setBusy] = useState(false);

    async function onCredential(idToken: string) {
        setBusy(true);
        setServerError("");
        try {
            await signIn(idToken);
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
                            Use your Google account. New here? Signing in creates your account.
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {serverError && <Notice tone="danger" role="alert" compact>{serverError}</Notice>}
                        {googleClientId ? (
                            <GoogleSignInButton onCredential={onCredential} onError={setServerError} />
                        ) : (
                            <Notice tone="warning" role="alert" compact>Google sign-in isn't set up yet. Ask the site owner to finish the setup.</Notice>
                        )}
                        {busy && <Typography variant="bodySm" color="text.secondary" role="status">Signing you in…</Typography>}
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
