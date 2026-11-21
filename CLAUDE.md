# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Rental website for a real client — treat it as production code (validate input, protect personal/booking data, no placeholder security).
Rentals are created and managed by the owner of the site users should not be able to create anything within the application 

- .NET 10 ASP.NET Core web app in `RentalWeb/` (nullable + implicit usings enabled).
- Stack: React SPA in `RentalFrontend/` talking to the ASP.NET Core backend's `/api/*` endpoints (API controllers in `controllers/`), with EF Core and SQLite for data. Follow those choices rather than introducing Razor Pages/MVC views, Blazor, or another database.
- Auth uses ASP.NET Core Identity (`models/User.cs` extends `IdentityUser`) as the user store, and **Google is the only way to sign in: there are no passwords, registration or confirmation emails**. `POST /api/auth/google` (`Services/SignInService.cs`) verifies a Google ID token (`GoogleTokenVerifier`, audience `GOOGLE_CLIENT_ID`), creates/links the user (Google account stored in `AspNetUserLogins`), sets the role (`Admin` if the email is in `ADMIN_EMAILS`, else `User`, reconciled each sign-in) and returns the app JWT from `JwtService.IssueToken`. Don't add password handling or seed users.
- Never put secrets (connection-string passwords, API keys, the JWT signing key) in `appsettings*.json`. In dev, `Program.cs` loads a git-ignored `.env` (copy `RentalWeb/.env.example` to `RentalWeb/.env` or the repo root; the root template was removed) from the working directory or the nearest parent that has one, via DotNetEnv `Env.NoClobber().TraversePath().Load()`; variables already set in the real environment win. In production, set real environment variables (docker-compose reads only the root `.env` and passes the values through). `ADMIN_ROLE_ID` is required by `RentalDbContext` (fixed seed id), so the app **and `dotnet ef`/migrations fail without it**; changing it creates a new migration diff. `GOOGLE_CLIENT_ID` (also baked into the frontend as `VITE_GOOGLE_CLIENT_ID`) and `ADMIN_EMAILS` (comma-separated) configure sign-in; outside Development the app throws at startup if `GOOGLE_CLIENT_ID` is unset.
- `/api/*` endpoints use JWT bearer auth (`security/AuthenticationSetup.cs`, tokens issued by `Services/JwtService.cs`). The signing key comes from the `JWT_KEY` environment variable (at least 32 chars). `JwtService` reads issuer, audience and lifetime from the `JWTConfig` section of `appsettings.json`, but `AuthenticationSetup.cs` currently hard-codes the issuer/audience it validates against, so change both together. The app throws at startup if `JWT_KEY` is unset.
- Namespaces use the root `RentalWebsite.*` (e.g. `RentalWebsite.Services`) even though the project is `RentalWeb`; generated migrations use `RentalWeb.Migrations`. Folders are mixed case (`controllers/`, `models/` vs `Services/`). Match the existing folder when adding files.
- `Program.cs` applies pending EF migrations at startup (`Database.Migrate()`); create them with the `/ef-migration` skill (`/verify` builds and smoke-tests the app).
- The backend does not serve the SPA: `GET /` is a "Hello World!" stub, and only nginx (Docker) or Vite (dev) serves the frontend. `/verify` therefore only smoke-tests that stub, not the UI or `/api`.
- The build enforces `.editorconfig` style (`EnforceCodeStyleInBuild`, `latest-recommended` analyzers). Fix analyzer/style warnings instead of suppressing them; the one deliberate suppression is CS1591 (missing XML docs) under `GenerateDocumentationFile`.

## Payments (Stripe)

- Stripe.net via `Services/StripeService.cs` and `controllers/StripeController.cs` (checkout, payments, cancel/refund + webhook), all routes under `api/Stripe/`. Service failures throw `PaymentException` carrying a `PaymentErrorKind`, which the controller maps to responses. Models: Booking, Payment, Refund, StripeWebhookEvent; `User.StripeCustomerId`.
- Local dev runs against a stripe-mock Docker image, selected with `STRIPE_MOCK=true` (client points at http://localhost:12111; both launch profiles set it). With the mock on, `STRIPE_SECRET_KEY` is ignored in favour of a fixed test key. A real Stripe test-mode account will be added too, so never hard-code the mock. Keep keys and webhook secrets in env vars only: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_BASE_URL` (builds the Stripe success/cancel redirect URLs).
- Booking rules live in the `Booking` section of `appsettings.json` (`CheckoutHoldMinutes`, `CancellationWindowDays`, `LateCancellationFeePercent`), bound by `models/BookingOptions.cs` with `ValidateOnStart`. `CheckoutHoldMinutes` must be 31–1440 (Stripe's 30-minute session minimum); an out-of-range value stops startup.
- The webhook must verify the Stripe signature and be idempotent (dedupe via `StripeWebhookEvent`). Never trust client-supplied amounts or status; derive them server-side.
- Money is stored as integer minor units with a 3-char `Currency`. Status is stored as a string.
- Don't rename the existing `Payements` migration (typo, already applied).

## Deployment direction (not built yet)

- Target is AWS: backend as Lambda + API Gateway, frontend as static files on S3. Database will move from SQLite to Aurora Serverless later; for now stay on SQLite.
- Keep code Lambda-friendly: no local-disk state besides the DB, no in-process background work, config only from env vars, and keep EF provider-specific code isolated so the DB swap is cheap.
- Don't add AWS infrastructure or switch databases until asked. The Docker/nginx setup stays the working deployment for now.

## Frontend (`RentalFrontend/`)

- React 19 + TypeScript + Vite, React Router, MUI (Emotion). The React Compiler is enabled (babel plugin in `vite.config.ts`), so don't add manual `useMemo`/`useCallback`/`memo` for performance.
- `tsconfig` sets `noUnusedLocals`/`noUnusedParameters`, so an unused variable or import fails `npm run build` (and the Docker image build). `strict` is not enabled.
- Layout: `pages/` (routes, wired in `App.tsx`), `components/`, `models/` (TS types), `services/` (data access, formatting, validation), `context/` (auth), `theme/`. Static page content lives in `src/json/*.json` (loaded via `services/json.ts`); listings come from the API (`services/RentalService.ts`, loaded in pages with `services/useRemote.ts`) and checkout, cancel quotes and cancellation from `services/StripeService.ts`. The My rentals page loads the signed-in user's bookings from `GET /api/Bookings` (`services/BookingService.ts`, which maps the API's booking to display strings); `BookingsController` is read-only and always scoped to the caller, and cancelling stays in `StripeController`.
- Styling: the Harbor & Hitch design system. Take colours, fonts, type scale, radii and shadows from `src/theme/tokens.ts` (the MUI theme in `theme.ts` is built from it; shared `sx` snippets are in `theme/styles.ts`); don't hard-code hex values or font stacks in components. Use the theme's Typography variants (`displayLg`, `headingSm`, `bodySm`, `label`, `price`, ...). MUI v9 dropped composed class keys like `containedPrimary`; use `variants` in theme overrides.
- Call the backend with relative `/api/...` URLs. Vite (dev, port 3000, proxying to http://localhost:5000) and nginx (Docker) both proxy `/api/` to the backend, so no CORS is configured.
- The session (email, access token, expiry) is kept in `sessionStorage` by `services/sessionStore.ts` and restored by `context/AuthProvider.tsx` on load, so a reload doesn't sign the user out; never use localStorage, and don't store anything else there (`isAdmin` is re-derived from the token). Admin UI shows when the JWT has an `Admin` role claim, which is cosmetic, so the API must authorize admin actions itself.
- `VITE_*` env vars are baked into the bundle at build time, so never put secrets in them.

## Commands

`RentalWebsite.slnx` references `RentalWeb`; the commands below still target the project explicitly:

- Build: `dotnet build RentalWeb`
- Run: `dotnet run --project RentalWeb` → http://localhost:5000 (`--launch-profile https` serves https://localhost:5000; both profiles set `STRIPE_MOCK=true`)
- Format: `dotnet format RentalWeb` (a PostToolUse hook in `.claude/settings.json` already runs `dotnet format whitespace` on `.cs` files after each edit, so you rarely need it by hand)
- Frontend (from `RentalFrontend/`): `npm run dev`, `npm run build` (type-checks with `tsc -b` first), `npm run lint`
- Full stack in Docker: `docker compose up --build` → http://localhost:8080 (needs `JWT_KEY`, `ADMIN_ROLE_ID`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `APP_BASE_URL` in the root `.env`; the backend isn't published on the host). In Docker the backend listens on 8080 (exposed only), runs with `ASPNETCORE_ENVIRONMENT=Production` (so `GOOGLE_CLIENT_ID` is mandatory), and keeps SQLite at `/app/data/rental.db` on the `rental-data` volume.

Tests: `dotnet test RentalServerTests` (xUnit; backend only, the frontend has none). `unit/` tests one StripeService method, the controller, or the config/read models (`BookingOptionsTests`, `PaymentReadTests`) at a time; `integration/` runs whole booking journeys through controller → service → SQLite. Both use `support/`: an in-memory SQLite DB and `FakeStripeHandler`, a stateful fake of api.stripe.com plugged into a real `StripeClient`, so tests never need the network, stripe-mock, or real keys. Test classes are named for the feature (`CancelBookingTests`), and `support/TestEnvironment.cs` sets the env vars (`ADMIN_ROLE_ID`, `JWT_KEY`) the code under test requires; `FakeGoogleTokenVerifier` stands in for Google, and `support/RentalApiHost.cs` hosts the real JWT/authorize pipeline over HTTP so 401/403 can be tested. See `docs/StripeService.md` for how the service works.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).