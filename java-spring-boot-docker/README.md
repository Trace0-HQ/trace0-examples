# Java Spring Boot Docker Example

Three Spring Boot services running in Docker containers, with Trace0 installed for observability. This project includes:

* `app/hello-service` — the public entry point (port 8090), calls user-service and greeting-service.
* `app/user-service` — contains the endpoints to load/store users in DynamoDB. Seeds five users on startup.
* `app/greeting-service` — returns a locale-aware greeting for hello-service to combine with the user's name.
* `DynamoDB Local` — a local version of AWS DynamoDB.

## Running It Locally

Before starting, set your Trace0 API key in each service's `application.properties` file. Replace `YOUR_TRACE0_ENV_API_KEY` in all three properties, in all three files:

```properties
management.opentelemetry.tracing.export.otlp.headers.X-API-KEY=YOUR_TRACE0_ENV_API_KEY
management.otlp.metrics.export.headers.X-API-KEY=YOUR_TRACE0_ENV_API_KEY
management.opentelemetry.logging.export.otlp.headers.X-API-KEY=YOUR_TRACE0_ENV_API_KEY
```

The files to update are:
* `app/hello-service/src/main/resources/application.properties`
* `app/user-service/src/main/resources/application.properties`
* `app/greeting-service/src/main/resources/application.properties`

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then start everything:

```bash
docker compose up --build
```

This builds and starts four containers: `dynamodb-local`, `user-service` (port 8081), `greeting-service` (port 8082), and `hello-service` (port 8090). `user-service` seeds five users (ids 1–5) into DynamoDB Local on startup.

Call hello-service, which in turn calls user-service and greeting-service:

```bash
curl --location 'http://localhost:8090/api/1'
```

```bash
curl --location 'http://localhost:8090/api/2'
```

To stop everything (and clear the in-memory table):

```bash
docker compose down
```

## Seeing It In Action

Coming soon!
