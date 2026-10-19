---
name: ef-migration
description: Add an EF Core migration for RentalWeb and apply it to the SQLite database.
disable-model-invocation: true
---

Create and apply an EF Core migration named `$ARGUMENTS`.

1. Ensure tooling: `dotnet ef --version`. If missing, ask before running `dotnet tool install --global dotnet-ef`. The project needs `Microsoft.EntityFrameworkCore.Design` and `Microsoft.EntityFrameworkCore.Sqlite`; if absent, ask before adding them.
2. Build first: `dotnet build RentalWeb` — fix errors before generating.
3. Add: `dotnet ef migrations add $ARGUMENTS --project RentalWeb`.
4. Review the generated migration. Flag anything destructive (dropped tables/columns, type changes, non-nullable columns added without defaults) and SQLite limitations (operations EF must emulate via table rebuilds). Show `dotnet ef migrations script --idempotent --project RentalWeb` output for the new migration if it's non-trivial.
5. If anything destructive was flagged, stop and get confirmation. Otherwise apply: `dotnet ef database update --project RentalWeb`.
6. Report the migration files created and the schema changes applied.
