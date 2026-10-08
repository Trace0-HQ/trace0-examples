# Python Redis Docker Example

A `FastAPI` app running in a Docker container, with Trace0 installed for observability. This project includes:

* `app/` — the `FastAPI` app that contains the endpoints to create, load, edit and delete users in Redis, using the `redis-py` client.
* `Redis` — a Redis server running in its own container.

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

This builds and starts two containers: `redis` and `app` (port 8080, mapped from the container's internal port 8000 to avoid clashing with redis's own port 6379).

## Seeing It In Action

Once the containers start up, the service will be available at `http://localhost:8080`.

### Calling the Service

Create a user by sending a `POST` request to the `/users` endpoint:

```bash
curl --location 'http://localhost:8080/users' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "Jon Smith",
    "email": "jon.smith@example.com"
  }'
```

The response body returns a `userId` field, which you can use to load, edit or delete the user:

```bash
curl --location 'http://localhost:8080/users/<userId>'
```

```bash
curl --location --request PUT 'http://localhost:8080/users/<userId>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "Jon Smith",
    "email": "jon.smith.updated@example.com"
  }'
```

```bash
curl --location --request DELETE 'http://localhost:8080/users/<userId>'
```
