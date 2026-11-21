import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthContext, type AuthState, type AuthUser } from "../context/auth";
import { theme } from "../theme/theme";

export const testUser: AuthUser = {
    email: "alice@example.test",
    accessToken: "test-token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    isAdmin: false,
};

interface Options {
    user?: AuthUser | null;
    route?: string;
    auth?: Partial<AuthState>;
}

// Renders with what pages expect around them: router, MUI theme (custom typography variants need it) and auth
export function renderWithProviders(ui: ReactElement, { user = null, route = "/", auth }: Options = {}) {
    const state: AuthState = { user, signIn: vi.fn(), signOut: vi.fn(), ...auth };
    return {
        auth: state,
        ...render(
            <ThemeProvider theme={theme}>
                <AuthContext value={state}>
                    <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
                </AuthContext>
            </ThemeProvider>,
        ),
    };
}
