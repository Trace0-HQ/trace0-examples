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

## Seeing It in Action

### Calling the Service

You can then load a user by calling the `hello-service` endpoint, which in turn calls the `user-service` and `greeting-service` services:

```bash
curl --location 'http://localhost:8090/api/1'
```

```bash
curl --location 'http://localhost:8090/api/2'
```

### Viewing Transactions

You can then view the list of transactions for each service in the Trace0 dashboard:

![Dashboard light mode](docs/screenshots/transactions-light.png#gh-light-mode-only)
![Dashboard dark mode](docs/screenshots/transactions-dark.png#gh-dark-mode-only)

### Viewing Transaction Detail

To view more details for a single transaction, click on it to see a full breakdown — including all spans, logs, and time taken across each component and service:

![Transaction detail flow light mode](docs/screenshots/transaction-detail-flow-light.png#gh-light-mode-only)
![Transaction detail flow dark mode](docs/screenshots/transaction-detail-flow-dark.png#gh-dark-mode-only)

![Transaction detail component breakdown light mode](docs/screenshots/transaction-detail-breakdown-light.png#gh-light-mode-only)
![Transaction detail component dark mode](docs/screenshots/transaction-detail-breakdown-dark.png#gh-dark-mode-only)

![Transaction detail service breakdown light mode](docs/screenshots/transaction-detail-service-breakdown-light.png#gh-light-mode-only)
![Transaction detail service breakdown dark mode](docs/screenshots/transaction-detail-service-breakdown-dark.png#gh-dark-mode-only)

See our [Transaction Detail section](https://docs.trace0hq.com/platform/transactions) in our user guide for more details.

### Errors

To trigger a failing transaction, call the `hello-service` `/api/{userId}` endpoint with a user ID that does not exist, e.g.

```bash
curl --location 'http://localhost:8090/api/15'
```

The transaction will appear as an error in Trace0, with the full error details and stack trace included:

![Transaction error light mode](docs/screenshots/transaction-error-light.png#gh-light-mode-only)
![Transaction error dark mode](docs/screenshots/transaction-error-dark.png#gh-dark-mode-only)

You can also set up alerts to be notified in real time when an error occurs. See our [Alerts section](https://docs.trace0hq.com/platform/alerts) in our user guide for more details.

### Metrics

You can view metrics for each service by clicking into the `Metrics` section:

![Metrics light mode](docs/screenshots/metrics-light.png#gh-light-mode-only)
![Metrics dark mode](docs/screenshots/metrics-dark.png#gh-dark-mode-only)

See our [Metrics section](https://docs.trace0hq.com/platform/metrics) in our user guide for more details.