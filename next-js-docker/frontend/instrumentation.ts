// Next.js calls register() once when the server process starts. This app runs
// as a plain long-running Docker container (unlike next-js-lambda), so there's
// no Lambda execution-environment freeze to work around here — @vercel/otel's
// default batching span processor is fine as-is, no need to force synchronous
// per-span export the way next-js-lambda's instrumentation.ts does.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOTel } = await import('@vercel/otel');

    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME,
    });

    // Wraps console methods with OTel traceId/spanId for log-trace correlation,
    // the same as the EC2/ECS examples.
    await import('@trace0/otel-logger');
  }
}
