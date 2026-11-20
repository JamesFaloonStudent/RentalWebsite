// The slice of Google Identity Services (https://accounts.google.com/gsi/client) this app uses
interface GoogleCredentialResponse {
    // The Google ID token (a JWT) the backend verifies at POST /api/auth/google
    credential : string;
}

interface Window {
    google? : {
        accounts : {
            id : {
                initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
                renderButton(parent: HTMLElement, options: { type?: "standard"; theme?: "outline" | "filled_blue" | "filled_black"; size?: "large" | "medium" | "small"; text?: "signin_with" | "continue_with"; shape?: "rectangular" | "pill"; width?: number; logo_alignment?: "left" | "center" }): void;
            };
        };
    };
}
