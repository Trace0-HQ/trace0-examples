export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@trace0/otel-logger');

    const { registerOTel } = await import('@vercel/otel');

    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME,
    });
  }
}
