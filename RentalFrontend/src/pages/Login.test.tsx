import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, testUser } from "../test/render";
import Login from "./Login";

const config = vi.hoisted(() => ({ clientId: "client-id" as string | undefined }));
vi.mock("../services/google", () => ({
    get googleClientId() { return config.clientId; },
}));

// Google's real button needs their script; this one just hands back a credential or an error on click
vi.mock("../components/GoogleSignInButton", () => ({
    default: ({ onCredential, onError }: { onCredential: (token: string) => void; onError: (message: string) => void }) => (
        <>
            <button type="button" onClick={() => onCredential("google-token")}>Mock Google sign-in</button>
            <button type="button" onClick={() => onError("Google sign-in couldn't be loaded.")}>Mock Google failure</button>
        </>
    ),
}));

describe("Login", () => {
    beforeEach(() => { config.clientId = "client-id"; });

    it("shows the Google button when signed out", () => {
        renderWithProviders(<Login />, { route: "/login" });

        expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mock Google sign-in" })).toBeInTheDocument();
    });

    it("tells the owner when Google sign-in isn't set up", () => {
        config.clientId = undefined;

        renderWithProviders(<Login />, { route: "/login" });

        expect(screen.getByRole("alert")).toHaveTextContent("Google sign-in isn't set up yet");
        expect(screen.queryByRole("button", { name: "Mock Google sign-in" })).not.toBeInTheDocument();
    });

    it("passes the Google credential to signIn", async () => {
        const signIn = vi.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();
        renderWithProviders(<Login />, { route: "/login", auth: { signIn } });

        await user.click(screen.getByRole("button", { name: "Mock Google sign-in" }));

        expect(signIn).toHaveBeenCalledWith("google-token");
    });

    it("shows a signing-in message while the request is pending", async () => {
        const signIn = vi.fn(() => new Promise<void>(() => {}));
        const user = userEvent.setup();
        renderWithProviders(<Login />, { route: "/login", auth: { signIn } });

        await user.click(screen.getByRole("button", { name: "Mock Google sign-in" }));

        expect(await screen.findByText("Signing you in…")).toBeInTheDocument();
    });

    it("shows the error when sign-in fails", async () => {
        const signIn = vi.fn().mockRejectedValue(new Error("Google sign-in didn't work. Try again."));
        const user = userEvent.setup();
        renderWithProviders(<Login />, { route: "/login", auth: { signIn } });

        await user.click(screen.getByRole("button", { name: "Mock Google sign-in" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in didn't work");
        await waitFor(() => expect(screen.queryByText("Signing you in…")).not.toBeInTheDocument());
    });

    it("shows errors reported by the Google button itself", async () => {
        const user = userEvent.setup();
        renderWithProviders(<Login />, { route: "/login" });

        await user.click(screen.getByRole("button", { name: "Mock Google failure" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be loaded");
    });

    it("welcomes a signed-in user instead of showing the button", () => {
        renderWithProviders(<Login />, { route: "/login", user: testUser });

        expect(screen.getByText("You're signed in")).toBeInTheDocument();
        expect(screen.getByText(/alice@example.test/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Mock Google sign-in" })).not.toBeInTheDocument();
    });
});
