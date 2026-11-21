import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Rental } from "../models/Rental";
import type { CancelBookingResponse, CancellationQuote } from "../services/StripeService";
import { renderWithProviders, testUser } from "../test/render";
import MyRentals from "./MyRentals";

const getMyRentals = vi.hoisted(() => vi.fn());
const getCancelQuote = vi.hoisted(() => vi.fn());
const cancelBooking = vi.hoisted(() => vi.fn());
const cancelPendingBooking = vi.hoisted(() => vi.fn());

vi.mock("../services/BookingService", () => ({ getMyRentals }));
vi.mock("../services/StripeService", () => ({ getCancelQuote, cancelBooking, cancelPendingBooking }));

function rental(overrides: Partial<Rental> = {}): Rental {
    return {
        id: "b1",
        listingId: "r1",
        category: "boats",
        name: "Sea Ray SPX 190",
        reference: "HH-ABCD-1234",
        tab: "upcoming",
        status: "Confirmed",
        dates: "Tue, Oct 20 – Thu, Oct 22 · 2 days",
        total: "$698",
        breakdown: "$349 × 2 days",
        note: "",
        ...overrides,
    };
}

function quote(overrides: Partial<CancellationQuote> = {}): CancellationQuote {
    return { bookingId: "b1", paidCents: 10000, feeCents: 0, refundCents: 10000, lateCancellation: false, cancellationWindowDays: 7, feePercent: 25, currency: "cad", ...overrides };
}

function cancelled(overrides: Partial<CancelBookingResponse> = {}): CancelBookingResponse {
    return { bookingId: "b1", status: "Cancelled", feeCents: 0, refundCents: 10000, ...overrides };
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });

function renderPage(user: typeof testUser | null = testUser) {
    return renderWithProviders(<MyRentals />, { user, route: "/my-rentals" });
}

describe("MyRentals", () => {
    beforeEach(() => {
        getMyRentals.mockReset();
        getCancelQuote.mockReset();
        cancelBooking.mockReset();
        cancelPendingBooking.mockReset();
    });

    it("asks a signed-out visitor to sign in", async () => {
        getMyRentals.mockResolvedValue([]);

        renderPage(null);

        expect(await screen.findByText("Sign in to see your rentals")).toBeInTheDocument();
        expect(screen.queryByText(/Loading your rentals/)).not.toBeInTheDocument();
    });

    it("loads with the signed-in user's token", async () => {
        getMyRentals.mockResolvedValue([]);

        renderPage();

        await waitFor(() => expect(getMyRentals).toHaveBeenCalledWith("test-token"));
    });

    it("shows a loading message while bookings load", () => {
        getMyRentals.mockReturnValue(new Promise(() => {}));

        renderPage();

        expect(screen.getByText("Loading your rentals…")).toBeInTheDocument();
    });

    it("shows the error when loading fails", async () => {
        getMyRentals.mockRejectedValue(new Error("We couldn't load your rentals right now. Try again in a moment."));

        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load your rentals");
    });

    it("shows an empty message on every tab when the user has no bookings", async () => {
        getMyRentals.mockResolvedValue([]);
        const user = userEvent.setup();
        renderPage();

        expect(await screen.findByText("No upcoming rentals yet.")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        await user.click(tab(/Active/));
        expect(screen.getByText("Nothing out right now.")).toBeInTheDocument();

        await user.click(tab(/Past/));
        expect(screen.getByText("No past rentals yet.")).toBeInTheDocument();
    });

    it("sorts bookings into tabs and counts them", async () => {
        getMyRentals.mockResolvedValue([
            rental({ id: "up1" }),
            rental({ id: "up2", name: "Pontoon trailer" }),
            rental({ id: "act", tab: "active", status: "Out now", name: "Active boat" }),
            rental({ id: "old", tab: "past", status: "Completed", name: "Old boat" }),
        ]);
        const user = userEvent.setup();
        renderPage();

        await screen.findByText("Sea Ray SPX 190");
        expect(tab(/Upcoming/)).toHaveTextContent("2");
        expect(tab(/Active/)).toHaveTextContent("1");
        expect(tab(/Past/)).toHaveTextContent("1");

        await user.click(tab(/Active/));
        expect(screen.getByText("Active boat")).toBeInTheDocument();
        expect(screen.queryByText("Sea Ray SPX 190")).not.toBeInTheDocument();
    });

    it("shows the booking's details", async () => {
        getMyRentals.mockResolvedValue([rental()]);

        renderPage();

        expect(await screen.findByText("Sea Ray SPX 190")).toBeInTheDocument();
        expect(screen.getByText("HH-ABCD-1234")).toBeInTheDocument();
        expect(screen.getByText("$698")).toBeInTheDocument();
        expect(screen.getByText("$349 × 2 days")).toBeInTheDocument();
    });

    describe("cancelling a paid booking", () => {
        it("shows the fee and refund from the server's quote when it's a late cancellation", async () => {
            getMyRentals.mockResolvedValue([rental()]);
            getCancelQuote.mockResolvedValue(quote({ lateCancellation: true, feeCents: 2500, refundCents: 7500 }));
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));

            const dialog = await screen.findByRole("alertdialog");
            await waitFor(() => expect(dialog).toHaveTextContent("a 25% fee ($25) is kept. You'll be refunded $75."));
            expect(getCancelQuote).toHaveBeenCalledWith("b1", "test-token");
        });

        it("promises a full refund only when the quote says so", async () => {
            getMyRentals.mockResolvedValue([rental()]);
            getCancelQuote.mockResolvedValue(quote());
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));

            await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent("full refund of $100"));
        });

        it("keeps the confirm button disabled until the quote arrives", async () => {
            getMyRentals.mockResolvedValue([rental()]);
            getCancelQuote.mockReturnValue(new Promise(() => {}));
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));

            expect(await screen.findByRole("button", { name: "Yes, cancel" })).toBeDisabled();
            expect(screen.getByRole("alertdialog")).toHaveTextContent("Checking what you'd get back");
        });

        it("shows the error and blocks cancelling when the quote fails", async () => {
            getMyRentals.mockResolvedValue([rental()]);
            getCancelQuote.mockRejectedValue(new Error("We couldn't work out the refund right now."));
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));

            await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent("couldn't work out the refund"));
            expect(screen.getByRole("button", { name: "Yes, cancel" })).toBeDisabled();
        });

        it("cancels, then moves the booking to Past as cancelled", async () => {
            getMyRentals.mockResolvedValue([rental()]);
            getCancelQuote.mockResolvedValue(quote());
            cancelBooking.mockResolvedValue(cancelled());
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));
            const confirm = await screen.findByRole("button", { name: "Yes, cancel" });
            await waitFor(() => expect(confirm).toBeEnabled());
            await user.click(confirm);

            await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith("b1", "test-token"));
            expect(cancelPendingBooking).not.toHaveBeenCalled();
            await waitFor(() => expect(tab(/Upcoming/)).toHaveTextContent("0"));
            expect(tab(/Past/)).toHaveTextContent("1");

            await user.click(tab(/Past/));
            const card = screen.getByRole("article");
            expect(within(card).getByText("Cancelled")).toBeInTheDocument();
            expect(within(card).getByText(/Refund on its way/)).toBeInTheDocument();
        });

        it("lets the user back out without calling cancel", async () => {
            getMyRentals.mockResolvedValue([rental()]);
            getCancelQuote.mockResolvedValue(quote());
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));
            await user.click(await screen.findByRole("button", { name: "Keep booking" }));

            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
            expect(cancelBooking).not.toHaveBeenCalled();
            expect(tab(/Upcoming/)).toHaveTextContent("1");
        });

        it("shows the server's error and leaves the booking alone when cancelling fails", async () => {
            getMyRentals.mockResolvedValue([rental()]);
            getCancelQuote.mockResolvedValue(quote());
            cancelBooking.mockRejectedValue(new Error("We couldn't cancel this booking right now."));
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));
            const confirm = await screen.findByRole("button", { name: "Yes, cancel" });
            await waitFor(() => expect(confirm).toBeEnabled());
            await user.click(confirm);

            await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent("couldn't cancel this booking"));
            expect(tab(/Upcoming/)).toHaveTextContent("1");
        });
    });

    describe("cancelling an unpaid booking", () => {
        it("skips the quote and uses cancel-pending", async () => {
            getMyRentals.mockResolvedValue([rental({ status: "Awaiting payment" })]);
            cancelPendingBooking.mockResolvedValue(cancelled({ refundCents: 0 }));
            const user = userEvent.setup();
            renderPage();

            await user.click(await screen.findByRole("button", { name: "Cancel booking" }));
            expect(screen.getByRole("alertdialog")).toHaveTextContent("Cancel this unpaid booking?");
            await user.click(screen.getByRole("button", { name: "Yes, cancel" }));

            await waitFor(() => expect(cancelPendingBooking).toHaveBeenCalledWith("b1", "test-token"));
            expect(getCancelQuote).not.toHaveBeenCalled();
            expect(cancelBooking).not.toHaveBeenCalled();
        });
    });

    it("doesn't offer to cancel a rental that's already out", async () => {
        getMyRentals.mockResolvedValue([rental({ tab: "active", status: "Out now" })]);
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("tab", { name: /Active/ }));

        expect(screen.getByText("Out now")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    });

    it("offers to book a past rental again", async () => {
        getMyRentals.mockResolvedValue([rental({ tab: "past", status: "Completed" })]);
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("tab", { name: /Past/ }));

        expect(screen.getByRole("link", { name: "Book again" })).toHaveAttribute("href", "/listings/r1/book");
    });
});
