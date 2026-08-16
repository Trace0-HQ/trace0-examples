# Java Javalin Docker Example

A Javalin app running in a Docker container, with Trace0 installed for observability. This project includes:

* `app/` — the Javalin app that contains the endpoints to load/store users in DynamoDB.
* `DynamoDB Local` — a local version of AWS DynamoDB.

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

This builds and starts two containers: `dynamodb-local` and `app` (port 8000). Once they're up, you can create a new user by sending a `POST` request to the `/users` endpoint:

```bash
curl --location 'http://localhost:8000/users' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "Jon Smith",
    "email": "jon.smith@example.com"
  }'
```

The response body will return a `userId` field, which you can then use to load a user by sending a `GET` request to the `/users/{userId}` endpoint:

```bash
curl --location 'http://localhost:8000/users/8b258bc7-3d48-4ee8-929e-0014762b0163'
```

To stop everything (and clear the in-memory table):

```bash
docker compose down
```

## Seeing It In Action

Coming soon!
