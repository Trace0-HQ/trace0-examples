# Python FastAPI Docker Example

A `FastAPI` app running in a Docker container, with Trace0 installed for observability. This project includes:

* `app/` — the `FastAPI` app that contains the endpoints to load/store users in DynamoDB.
* `DynamoDB Local` — a local version of `AWS DynamoDB`.

## Running It Locally

Before starting, set your Trace0 API key in `docker-compose.yml`. Replace `YOUR_TRACE0_ENV_API_KEY` in the app service's `OTEL_EXPORTER_OTLP_HEADERS`:

```yaml
OTEL_EXPORTER_OTLP_HEADERS: "X-API-KEY=YOUR_TRACE0_ENV_API_KEY"
```

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then start everything:

```bash
docker compose up --build
```

This builds and starts two containers: `dynamodb-local` and `app` (port 8080, mapped from the container's internal port 8000 to avoid clashing with dynamodb-local's own port 8000). Once they're up, create a user:

```bash
curl --location 'http://localhost:8080/users' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "Jon Smith",
    "email": "jon.smith@example.com"
  }'
```

The response body returns a `userId` field, which you can use to load the user:

```bash
curl --location 'http://localhost:8080/users/<userId>'
```

## Seeing It In Action

Coming soon!
