// Matches RentalWeb's LoginResponse record (System.Text.Json camelCases it)
export interface LoginResponse {
    email : string;
    accessToken : string;
    expiresIn : number;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (response.status === 401) {
        throw new Error("That email and password don't match an account.");
    }
    if (!response.ok) {
        throw new Error("We couldn't sign you in right now. Try again in a moment.");
    }

    return response.json() as Promise<LoginResponse>;
}

const roleClaimTypes = ["role", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

// Reads the token's role claim for showing admin UI only; the API must still authorize every admin request
export function tokenHasRole(accessToken: string, role: string): boolean {
    try {
        const payload = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const claims = JSON.parse(atob(payload)) as Record<string, unknown>;
        return roleClaimTypes.some(type => {
            const value = claims[type];
            return Array.isArray(value) ? value.includes(role) : value === role;
        });
    } catch {
        return false;
    }
}
