// The Google OAuth client id is public (it ships in the page), so a VITE_ variable is fine. It must be
// the same value as the backend's GOOGLE_CLIENT_ID, which checks the ID tokens were issued for it.
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
