function AboutPage() {
  return (
    <p>
      This is a second page, so you can navigate between routes and see <code>app.route.id</code>{' '}
      change on the log records in Trace0 — see <code>RouteTracker.tsx</code> and{' '}
      <code>otel.ts</code>'s <code>CustomAttributesProcessor</code>.
    </p>
  );
}

export default AboutPage;
