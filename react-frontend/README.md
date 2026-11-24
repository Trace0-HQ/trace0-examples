# React Frontend Example

A React app instrumented with OpenTelemetry's `@opentelemetry/browser-instrumentation` package, bootstrapped via `@opentelemetry/browser-sdk`, with Trace0 installed for observability. This project includes:

* `frontend/` — a React app (built with Vite, served by nginx) instrumented for `fetch()` tracing, user-action and Web Vitals logging.
* `backend/` — a Node.js Express backend that the frontend calls, to demonstrate frontend-to-backend trace linking.

Both services export directly to Trace0's OTLP ingest endpoint.

## Running It Locally

Before starting, set your Trace0 ingest API key in two places. You can find your ingest API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

In `docker-compose.yml`, replace `YOUR_TRACE0_INGEST_API_KEY` in the `backend` service's `OTEL_EXPORTER_OTLP_HEADERS`:

```yaml
OTEL_EXPORTER_OTLP_HEADERS: "X-API-KEY=YOUR_TRACE0_INGEST_API_KEY"
```

In `frontend/src/otel.ts`, replace `YOUR_TRACE0_INGEST_API_KEY` in `TRACE0_HEADERS`:

```ts
const TRACE0_HEADERS = {
  'X-API-KEY': 'YOUR_TRACE0_INGEST_API_KEY',
};
```

Both `frontend/` and `backend/` need their dependencies installed locally first, so each has a `package-lock.json` for the Docker build to use:

```bash
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

Then start everything:

```bash
docker compose up --build
```

This builds and starts two containers: `backend` and `frontend` (port 8080).

## Seeing It In Action

Once the containers start up, open `http://localhost:8080` in your browser.

Click the **Call Backend API** button to emit a `browser.user_action.click` event and create a linked frontend-to-backend trace. The user action events are shown in the frontend service metrics, while the trace is shown as a transaction in Trace0.

Click **Simulate Error** to throw an uncaught error, which shows up in Trace0 as a failing transaction.

Navigate to **About** and back to see `app.route.id` change on emitted events.
