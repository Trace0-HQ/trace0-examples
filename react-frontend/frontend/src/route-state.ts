// Holds the current route template (e.g. "/users/:id", not the resolved
// path), so otel.ts can tag telemetry with it without importing React.
// Call setCurrentRoute() from your router on every navigation.
let currentRoute: string | undefined;

export function setCurrentRoute(route: string | undefined): void {
  currentRoute = route;
}

export function getCurrentRoute(): string | undefined {
  return currentRoute;
}
