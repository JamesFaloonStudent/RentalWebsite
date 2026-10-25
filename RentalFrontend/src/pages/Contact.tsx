import { useState, type FormEvent, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import NativeSelect from "@mui/material/NativeSelect";
import Typography from "@mui/material/Typography";
import Header, { BackLink } from "../components/Header";
import Footer from "../components/Footer";
import PageBand from "../components/PageBand";
import PageSection from "../components/PageSection";
import SectionCard from "../components/SectionCard";
import FormField from "../components/FormField";
import ChipGroup from "../components/ChipGroup";
import Notice from "../components/Notice";
import { ClockIcon, MailIcon, PhoneIcon, PinIcon } from "../components/Icons";
import { getListings } from "../services/json";
import { isValidEmail } from "../services/validation";
import { colors, radius, typeScale } from "../theme/tokens";
import { controlSx, raisedCardSx, stickySx, twoColumnSx } from "../theme/styles";

type RequestType = "long" | "event" | "delivery" | "gear" | "other";
type ReplyMethod = "email" | "phone" | "text";

const MAX_MESSAGE = 1000;

const requestTypes: { value: RequestType; label: string; hint: string }[] = [
    { value: "long", label: "Longer rental", hint: "e.g. We'd like the pontoon for two weeks in August. Is there a weekly rate?" },
    { value: "event", label: "Event or group", hint: "e.g. Birthday cruise for 10 people on Saturday afternoon. Can you add a cooler and a tube?" },
    { value: "delivery", label: "Custom delivery", hint: "e.g. Can you deliver to our cottage dock on Lake Muskoka and pick up on Sunday?" },
    { value: "gear", label: "Extra gear", hint: "e.g. We need 4 extra child life jackets and a tow rope." },
    { value: "other", label: "Something else", hint: "Tell us what you have in mind." },
];

const replyMethods: { value: ReplyMethod; label: string }[] = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone call" },
    { value: "text", label: "Text" },
];

const helpTopics = [
    "Rentals longer than 14 days",
    "Parties, events and group bookings",
    "Delivery to a private dock or cottage",
    "Extra life jackets, tubes or towing gear",
    "Hitch or trailer questions before you book",
];

function Contact() {
    const [type, setType] = useState<RequestType | null>(null);
    const [message, setMessage] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [method, setMethod] = useState<ReplyMethod>("email");
    const [submitted, setSubmitted] = useState(false);
    const [sent, setSent] = useState(false);

    const typeError = submitted && !type;
    const messageError = submitted && !message.trim() && "Add a few words so we know what you need.";
    const nameError = submitted && !name.trim() && "Enter your name.";
    const emailError = submitted && !isValidEmail(email) && "Enter an email address like name@example.com.";

    function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSubmitted(true);
        if (type && message.trim() && name.trim() && isValidEmail(email)) {
            setSent(true);
        }
    }

    function startOver() {
        setSent(false);
        setSubmitted(false);
        setType(null);
        setMessage("");
    }

    return (
        <>
            <Header>
                <BackLink />
            </Header>

            <PageBand
                title="Contact the owner"
                subtitle="Planning something special? A week on the water, a party on the pontoon, delivery to a private dock, or extra gear — tell us what you need and we'll make it work."
            />

            <PageSection sx={{ pt: "48px", pb: "64px", ...twoColumnSx(400) }}>
                {sent ? (
                    <Notice
                        tone="success"
                        title="Request sent"
                        actions={
                            <>
                                <Button component={RouterLink} to="/" variant="contained">Back to rentals</Button>
                                <Button variant="text" onClick={startOver}>Send another request</Button>
                            </>
                        }
                    >
                        Thanks, {name.trim().split(" ")[0]}. Artem will get back to you by {method === "phone" ? "phone" : method} within [RESPONSE TIME].
                        Your request reference is <Typography variant="code" component="span">REQ-0000</Typography>.
                    </Notice>
                ) : (
                    <Box component="form" noValidate onSubmit={onSubmit} sx={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                        <SectionCard title="What's your request?">
                            <Box component="fieldset" sx={fieldsetSx}>
                                <Typography component="legend" variant="label" sx={{ mb: "8px" }}>Request type</Typography>
                                <ChipGroup options={requestTypes} value={type} onChange={setType} />
                                {typeError && <Typography variant="bodySm" color="error" sx={{ mt: "8px" }}>Choose the type of request.</Typography>}
                            </Box>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: "24px" }}>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <Typography component="label" htmlFor="contact-item" variant="label">Boat or trailer (optional)</Typography>
                                    <NativeSelect id="contact-item" disableUnderline defaultValue="" sx={{ ...controlSx(), "& select": { py: 0, height: 46 } }}>
                                        <option value="">Not sure yet</option>
                                        {getListings().map(listing => <option key={listing.id} value={listing.id}>{listing.name}</option>)}
                                    </NativeSelect>
                                </Box>
                                <FormField id="contact-date" label="Preferred start date (optional)" type="date" />
                            </Box>
                            <FormField
                                id="contact-message"
                                label="Tell us the details"
                                multiline
                                minRows={6}
                                value={message}
                                onChange={event => setMessage(event.target.value.slice(0, MAX_MESSAGE))}
                                placeholder={requestTypes.find(t => t.value === type)?.hint ?? "Dates, number of guests, where you want it delivered, anything extra you need."}
                                inputProps={{ maxLength: MAX_MESSAGE }}
                                error={messageError}
                                helper={<Box component="span" sx={{ display: "block", textAlign: "right" }}>{message.length} / {MAX_MESSAGE}</Box>}
                            />
                        </SectionCard>

                        <SectionCard title="How can we reach you?">
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: "24px" }}>
                                <FormField id="contact-name" label="Your name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} error={nameError} />
                                <FormField id="contact-email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} error={emailError} />
                                <FormField id="contact-phone" label="Phone (optional)" type="tel" autoComplete="tel" />
                                <Box component="fieldset" sx={fieldsetSx}>
                                    <Typography component="legend" variant="label" sx={{ mb: "8px" }}>Best way to reply</Typography>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", minHeight: 48, alignItems: "center" }}>
                                        {replyMethods.map(option => (
                                            <Box component="label" key={option.value} sx={{ ...typeScale.body, display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                                <Box component="input" type="radio" name="reply" checked={method === option.value} onChange={() => setMethod(option.value)} sx={{ width: 20, height: 20, m: 0, accentColor: colors.primaryText }} />
                                                {option.label}
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Box>
                        </SectionCard>

                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
                            <Button type="submit" variant="contained" size="large">Send request</Button>
                            <Typography variant="bodySm" color="text.secondary">No charge and no commitment. We'll reply with options and a price.</Typography>
                        </Box>
                    </Box>
                )}

                <Box component="aside" sx={{ ...stickySx, display: "flex", flexDirection: "column", gap: "24px" }}>
                    <Box sx={{ ...raisedCardSx, p: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <Box aria-hidden="true" sx={{ ...typeScale.caption, width: 64, height: 64, borderRadius: radius.pill, background: colors.surfaceSunken, color: colors.inkMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>Photo</Box>
                            <Box sx={{ display: "flex", flexDirection: "column" }}>
                                <Typography variant="headingSm" component="span">Artem</Typography>
                                <Typography variant="bodySm" component="span" color="text.secondary">Owner, Artem's Boating Rentals</Typography>
                            </Box>
                        </Box>
                        <Box component="dl" sx={{ m: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
                            <ContactRow icon={<PhoneIcon />} term="Phone or text"><Link href="#call">[PHONE NUMBER]</Link></ContactRow>
                            <ContactRow icon={<MailIcon />} term="Email"><Link href="#email">[EMAIL ADDRESS]</Link></ContactRow>
                            <ContactRow icon={<PinIcon />} term="Pickup yard">Burlington, near Guelph Line</ContactRow>
                            <ContactRow icon={<ClockIcon />} term="Hours">[OPENING HOURS]</ContactRow>
                        </Box>
                        <Typography variant="bodySm" color="text.secondary">Usually replies within [RESPONSE TIME]</Typography>
                    </Box>
                    <Box sx={{ p: "24px", borderRadius: radius.lg, background: colors.surfaceAlt, display: "flex", flexDirection: "column", gap: "12px" }}>
                        <Typography variant="headingSm" component="h2">Things we can help with</Typography>
                        <Box component="ul" sx={{ ...typeScale.bodySm, m: 0, pl: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {helpTopics.map(topic => <li key={topic}>{topic}</li>)}
                        </Box>
                    </Box>
                </Box>
            </PageSection>

            <Footer />
        </>
    )
}

function ContactRow({ icon, term, children }: { icon: ReactNode; term: string; children: ReactNode }) {
    return (
        <Box sx={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <Box component="span" sx={{ display: "flex", color: colors.primaryText, mt: "2px" }}>{icon}</Box>
            <Box>
                <Typography component="dt" variant="bodySm" color="text.secondary">{term}</Typography>
                <Typography component="dd" variant="body" sx={{ m: 0, fontWeight: 600 }}>{children}</Typography>
            </Box>
        </Box>
    );
}

const fieldsetSx = { m: 0, p: 0, border: 0, minWidth: 0 } as const;

export default Contact
