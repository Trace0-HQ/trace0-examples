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

This builds and starts two containers: `dynamodb-local` and `app` (port 8080, mapped from the container's internal port 8000 to avoid clashing with dynamodb-local's own port 8000).

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

The response body returns a `userId` field, which you can use to load the user:

```bash
curl --location 'http://localhost:8080/users/<userId>'
```

### Viewing Transactions

You can then view the list of transactions for this service in the Trace0 dashboard:

![Dashboard light mode](docs/screenshots/transactions-light.png#gh-light-mode-only)
![Dashboard dark mode](docs/screenshots/transactions-dark.png#gh-dark-mode-only)

### Viewing Transaction Detail

To view more details for a single transaction, click on it to see a full breakdown — including all spans, logs, and time taken across each component and service:

![Transaction detail flow light mode](docs/screenshots/transaction-detail-flow-light.png#gh-light-mode-only)
![Transaction detail flow dark mode](docs/screenshots/transaction-detail-flow-dark.png#gh-dark-mode-only)

![Transaction detail breakdown light mode](docs/screenshots/transaction-detail-breakdown-light.png#gh-light-mode-only)
![Transaction detail breakdown dark mode](docs/screenshots/transaction-detail-breakdown-dark.png#gh-dark-mode-only)

See our [Transaction Detail section](https://docs.trace0hq.com/platform/transactions) in our user guide for more details.

### Errors

To simulate a failing transaction, create a user with the email address `trigger-error@example.com`. The transaction will appear as an error in Trace0, with the full error details and stack trace included:


![Transaction error light mode](docs/screenshots/transaction-error-light.png#gh-light-mode-only)
![Transaction error dark mode](docs/screenshots/transaction-error-dark.png#gh-dark-mode-only)

You can also set up alerts to be notified in real time when an error occurs. See our [Alerts section](https://docs.trace0hq.com/platform/alerts) in our user guide for more details.

### Metrics

You can view metrics for this service by clicking into the `Metrics` section:

![Metrics light mode](docs/screenshots/metrics-light.png#gh-light-mode-only)
![Metrics dark mode](docs/screenshots/metrics-dark.png#gh-dark-mode-only)

See our [Metrics section](https://docs.trace0hq.com/platform/metrics) in our user guide for more details.
