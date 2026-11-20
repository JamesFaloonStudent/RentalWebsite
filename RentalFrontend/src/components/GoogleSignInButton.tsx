import { useEffect, useEffectEvent, useRef } from "react";
import { googleClientId } from "../services/google";

const GSI_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise: Promise<void> | undefined;

// Loads Google's sign-in library once per page
function loadGoogleScript(): Promise<void> {
    scriptPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            scriptPromise = undefined;
            reject(new Error("Google sign-in couldn't be loaded."));
        };
        document.head.appendChild(script);
    });
    return scriptPromise;
}

interface GoogleSignInButtonProps {
    // Called with the Google ID token after the user picks an account
    onCredential : (idToken: string) => void;
    onError : (message: string) => void;
}

// Google's official "Sign in with Google" button (their branding rules require their own button)
export default function GoogleSignInButton({ onCredential, onError }: GoogleSignInButtonProps) {
    const container = useRef<HTMLDivElement>(null);
    const handleCredential = useEffectEvent(onCredential);
    const handleError = useEffectEvent(onError);

    useEffect(() => {
        let cancelled = false;
        loadGoogleScript().then(() => {
            const parent = container.current;
            if (cancelled || !parent || !window.google || !googleClientId) {
                return;
            }
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: response => handleCredential(response.credential),
            });
            window.google.accounts.id.renderButton(parent, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 320 });
        }, (error: Error) => {
            if (!cancelled) {
                handleError(error.message);
            }
        });
        return () => { cancelled = true; };
    }, []);

    return <div ref={container} aria-label="Sign in with Google" />;
}
