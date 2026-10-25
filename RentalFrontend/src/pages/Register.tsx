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
import { CheckIcon, CircleIcon, TrailerIcon } from "../components/Icons";
import { isValidEmail, passwordRules } from "../services/validation";
import { colors, typeScale } from "../theme/tokens";
import { navLinkSx } from "../theme/styles";

const perks = ["See every booking in one place", "Save your delivery address", "Book again from past rentals"];

function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [terms, setTerms] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [done, setDone] = useState(false);

    const passwordOk = passwordRules.every(rule => rule.test(password));
    const emailError = submitted && !isValidEmail(email) && "Enter an email address like name@example.com.";
    const passwordError = submitted && !passwordOk && "Choose a password that meets every rule below.";
    const confirmError = submitted && (!confirm || confirm !== password) && "Passwords don't match.";
    const termsError = submitted && !terms;

    function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitted(true);
        if (isValidEmail(email) && passwordOk && confirm === password && terms) {
            setDone(true);
        }
    }

    return (
        <AuthLayout
            photoIcon={<TrailerIcon size={72} strokeWidth={1.1} />}
            photoLabel="Brand photo: trailer hitched and ready"
            headline="Book in a few taps next time."
            pitch={
                <Box component="ul" sx={{ ...typeScale.body, m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {perks.map(perk => (
                        <Box component="li" key={perk} sx={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            <Box component="span" sx={{ display: "flex", color: colors.primaryText }}><CheckIcon /></Box>
                            {perk}
                        </Box>
                    ))}
                </Box>
            }
        >
            {done ? (
                <Notice tone="success" title="Your account is ready" actions={<Button component={RouterLink} to="/" variant="contained">Start browsing</Button>}>
                    We've sent a confirmation link to {email.trim()}.
                </Notice>
            ) : (
                <>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <Typography variant="headingLg" component="h1">Create an account</Typography>
                        <Typography variant="body" color="text.secondary">
                            Already have one? <Link component={RouterLink} to="/login" underline="always" sx={{ fontWeight: 600 }}>Sign in</Link>
                        </Typography>
                    </Box>

                    <Box component="form" noValidate onSubmit={onSubmit} sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <FormField
                            id="register-email"
                            label="Email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            error={emailError}
                        />
                        <PasswordField
                            id="register-password"
                            label="Password"
                            autoComplete="new-password"
                            value={password}
                            onChange={setPassword}
                            error={passwordError}
                            visible={showPasswords}
                            onToggleVisible={() => setShowPasswords(!showPasswords)}
                        />
                        <Box component="ul" aria-label="Password rules" sx={{ ...typeScale.bodySm, m: "-12px 0 0", p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {passwordRules.map(rule => {
                                const ok = rule.test(password);
                                return (
                                    <Box component="li" key={rule.text} sx={{ display: "flex", alignItems: "center", gap: "8px", color: ok ? colors.success : submitted ? colors.danger : colors.inkMuted }}>
                                        {ok ? <CheckIcon size={16} strokeWidth={2.25} /> : <CircleIcon size={16} />}
                                        {rule.text}
                                    </Box>
                                );
                            })}
                        </Box>
                        <PasswordField
                            id="register-confirm"
                            label="Confirm password"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={setConfirm}
                            error={confirmError}
                            visible={showPasswords}
                            onToggleVisible={() => setShowPasswords(!showPasswords)}
                        />
                        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <Box component="label" sx={{ ...typeScale.bodySm, display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
                                <Box
                                    component="input"
                                    type="checkbox"
                                    checked={terms}
                                    onChange={() => setTerms(!terms)}
                                    aria-invalid={termsError}
                                    sx={{ width: 20, height: 20, m: 0, flexShrink: 0, accentColor: colors.primaryText }}
                                />
                                <span>I agree to the <Link href="#terms" underline="always">rental terms</Link> and <Link href="#privacy" underline="always">privacy policy</Link>.</span>
                            </Box>
                            {termsError && <Typography variant="bodySm" color="error">Accept the terms to create an account.</Typography>}
                        </Box>
                        <Button type="submit" variant="contained" size="large">Create account</Button>
                    </Box>
                    <Link component={RouterLink} to="/" underline="none" sx={{ ...navLinkSx, alignSelf: "center" }}>Skip for now and browse rentals</Link>
                </>
            )}
        </AuthLayout>
    )
}

export default Register
