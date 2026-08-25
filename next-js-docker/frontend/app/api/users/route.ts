import { context, propagation } from '@opentelemetry/api';
import { flush } from '@trace0/otel-logger';

const BACKEND_API_URL = process.env.BACKEND_API_URL!;
const usersEndpoint = () => `${BACKEND_API_URL}/users`;

function withTraceContext(headers: Record<string, string>): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}

export async function POST(request: Request): Promise<Response> {
  try {
    console.log('Proxying create-user request to backend service');
    const body = await request.text();
    const backendResponse = await fetch(usersEndpoint(), {
      method: 'POST',
      headers: withTraceContext({ 'Content-Type': 'application/json' }),
      body,
    });
    return new Response(await backendResponse.text(), {
      status: backendResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await flush();
  }
}

export async function GET(): Promise<Response> {
  try {
    console.log('Proxying get-users request to backend service');
    const backendResponse = await fetch(usersEndpoint(), {
      headers: withTraceContext({}),
    });
    return new Response(await backendResponse.text(), {
      status: backendResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await flush();
  }
}
