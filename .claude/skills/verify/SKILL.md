---
name: verify
description: Build RentalWeb, start it, and smoke-test that it serves requests. Use after making changes to confirm the app still builds and runs.
---

1. Build: `dotnet build RentalWeb`. On failure, report the errors and stop.
2. Start the app in the background: `dotnet run --project RentalWeb --no-build --launch-profile http` (serves http://localhost:5000). Wait until it logs `Now listening on`.
3. Smoke-test with curl:
   - `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5000/` should return 200.
   - Also request any routes/pages touched by the current change and check the status code and that the body contains the expected content.
4. Stop the app process.
5. Report: build result, each URL checked with its status, and any errors from the app's console output.
