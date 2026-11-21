// Authenticated JSON call to the backend. A 401 means the in-memory token expired; other failures
// carry a { message } the user can act on (400/404/409), or fall back to the given text.
export async function apiRequest<T>(url: string, accessToken: string, fallback: string, method: "GET" | "POST" = "GET"): Promise<T> {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}` } });

    if (response.status === 401) {
        throw new Error("Your session has expired. Sign in again to continue.");
    }
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? fallback);
    }
    return response.json() as Promise<T>;
}
