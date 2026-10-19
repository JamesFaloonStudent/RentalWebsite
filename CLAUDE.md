# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Rental website for a real client — treat it as production code (validate input, protect personal/booking data, no placeholder security).

- .NET 10 ASP.NET Core web app in `RentalWeb/` (nullable + implicit usings enabled).
- Planned stack: Razor Pages / MVC UI, EF Core with SQLite. Follow those choices rather than introducing APIs-plus-SPA, Blazor, or another database.

## Commands

`RentalWebsite.slnx` is currently empty (the project isn't added to it), so target the project explicitly:

- Build: `dotnet build RentalWeb`
- Run: `dotnet run --project RentalWeb` → http://localhost:5000 (`--launch-profile https` adds https://localhost:7000)
- Format: `dotnet format RentalWeb`

There is no test project yet.
