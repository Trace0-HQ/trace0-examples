# Next.js Docker Example

A Next.js app and a Node.js backend, both running in Docker containers, with Trace0 installed for observability. This project includes:

* `frontend/` — the Next.js app
* `backend/` — an Express service that contains the endpoints to load/store users in DynamoDB.
* `DynamoDB Local` — a local version of AWS DynamoDB.

## Running It Locally

Before starting, set your Trace0 API key in `docker-compose.yml`. Replace `YOUR_TRACE0_ENV_API_KEY` in both the `frontend` and `backend` services' `OTEL_EXPORTER_OTLP_HEADERS`:

```yaml
OTEL_EXPORTER_OTLP_HEADERS: "X-API-KEY=YOUR_TRACE0_ENV_API_KEY"
```

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Both `frontend/` and `backend/` need their dependencies installed locally first, so each has a `package-lock.json` for the Docker build to use:

```bash
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

Then start everything:

```bash
docker compose up --build
```

This builds and starts three containers: `dynamodb-local`, `backend` (port 4000), and `frontend` (port 3000). Once they're up, open [http://localhost:3000](http://localhost:3000) to create and list users.

## Seeing It In Action

Coming soon!
