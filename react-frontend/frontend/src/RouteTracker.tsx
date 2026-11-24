import { useEffect } from 'react';
import { useMatches } from 'react-router';
import { setCurrentRoute } from './route-state';

// Updates route-state.ts on every navigation, so otel.ts's
// CustomAttributesProcessor can tag telemetry with the current route.
// Renders nothing — mount it once, inside the router.
function RouteTracker() {
  const matches = useMatches();
  const leaf = matches[matches.length - 1];

  useEffect(() => {
    setCurrentRoute(leaf?.id ?? leaf?.pathname);
  }, [leaf]);

  return null;
}

export default RouteTracker;
