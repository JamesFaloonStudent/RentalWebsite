# syntax=docker/dockerfile:1

# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the package layer is cached until the csproj changes
COPY .editorconfig ./
COPY RentalWeb/RentalWeb.csproj RentalWeb/
RUN dotnet restore RentalWeb/RentalWeb.csproj

COPY RentalWeb/ RentalWeb/
RUN dotnet publish RentalWeb/RentalWeb.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# SQLite lives on a volume mounted here; create it owned by the non-root user
# so a fresh named volume inherits writable permissions
RUN mkdir -p /app/data && chown app:app /app/data

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ConnectionStrings__DefaultConnection="Data Source=/app/data/rental.db"

USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "RentalWeb.dll"]
