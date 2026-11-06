# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Rental website for a real client — treat it as production code (validate input, protect personal/booking data, no placeholder security).

- .NET 10 ASP.NET Core web app in `RentalWeb/` (nullable + implicit usings enabled).
- Stack: React SPA in `RentalFrontend/` talking to the ASP.NET Core backend's `/api/*` endpoints (API controllers in `controllers/`), with EF Core and SQLite for data. Follow those choices rather than introducing Razor Pages/MVC views, Blazor, or another database.
- Auth uses ASP.NET Core Identity (`models/User.cs` extends `IdentityUser`). Extend it; don't write custom auth or password handling.
- Never put secrets (connection-string passwords, API keys, the JWT signing key) in `appsettings*.json`. In dev, `Program.cs` loads a git-ignored `.env` (copy `.env.example`) from the working directory or the nearest parent that has one, via DotNetEnv `Env.NoClobber().TraversePath().Load()`; variables already set in the real environment win. In production, set real environment variables (docker-compose passes them through from its own `.env`).
- `/api/*` endpoints use JWT bearer auth (`security/AuthenticationSetup.cs`, tokens issued by `Services/JwtService.cs`). The signing key comes from the `JWT_KEY` environment variable (at least 32 chars). `JwtService` reads issuer, audience and lifetime from the `JWTConfig` section of `appsettings.json`, but `AuthenticationSetup.cs` currently hard-codes the issuer/audience it validates against, so change both together. The app throws at startup if `JWT_KEY` is unset.
- Namespaces use the root `RentalWebsite.*` (e.g. `RentalWebsite.Services`) even though the project is `RentalWeb`; generated migrations use `RentalWeb.Migrations`. Folders are mixed case (`controllers/`, `models/` vs `Services/`). Match the existing folder when adding files.
- `Program.cs` applies pending EF migrations at startup (`Database.Migrate()`); create them with the `/ef-migration` skill.
- The build enforces `.editorconfig` style (`EnforceCodeStyleInBuild`, `latest-recommended` analyzers). Fix analyzer/style warnings instead of suppressing them.

## Frontend (`RentalFrontend/`)

- React 19 + TypeScript + Vite, React Router, MUI (Emotion). The React Compiler is enabled (babel plugin in `vite.config.ts`), so don't add manual `useMemo`/`useCallback`/`memo` for performance.
- `tsconfig` sets `noUnusedLocals`/`noUnusedParameters`, so an unused variable or import fails `npm run build` (and the Docker image build). `strict` is not enabled.
- Layout: `pages/` (routes, wired in `App.tsx`), `components/`, `models/` (TS types), `services/` (data access, formatting, validation), `context/` (auth), `theme/`. Static page content and sample listings/rentals live in `src/json/*.json`, loaded through `services/json.ts`.
- Styling: the Harbor & Hitch design system. Take colours, fonts, type scale, radii and shadows from `src/theme/tokens.ts` (the MUI theme in `theme.ts` is built from it; shared `sx` snippets are in `theme/styles.ts`); don't hard-code hex values or font stacks in components. Use the theme's Typography variants (`displayLg`, `headingSm`, `bodySm`, `label`, `price`, ...). MUI v9 dropped composed class keys like `containedPrimary`; use `variants` in theme overrides.
- Call the backend with relative `/api/...` URLs. Vite (dev, port 5173) and nginx (Docker) both proxy `/api/` to the backend, so no CORS is configured.
- The access token is held in memory only (`context/AuthProvider.tsx`); don't move it to localStorage. Admin UI shows when the JWT has an `Admin` role claim, which is cosmetic, so the API must authorize admin actions itself.
- `VITE_*` env vars are baked into the bundle at build time, so never put secrets in them.

## Commands

`RentalWebsite.slnx` is currently empty (the project isn't added to it), so target the project explicitly:

- Build: `dotnet build RentalWeb`
- Run: `dotnet run --project RentalWeb` → http://localhost:5000 (`--launch-profile https` adds https://localhost:7000)
- Format: `dotnet format RentalWeb`
- Frontend (from `RentalFrontend/`): `npm run dev`, `npm run build` (type-checks with `tsc -b` first), `npm run lint`
- Full stack in Docker: `docker compose up --build` → http://localhost:8080 (needs `JWT_KEY` in the root `.env`; the backend isn't published on the host)

There are no tests yet in either app.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
