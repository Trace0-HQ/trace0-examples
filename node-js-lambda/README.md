# AWS Lambda Node.js Example

A Node.js service deployed on AWS Lambda, with Trace0 installed for observability. The service includes:

* An API Gateway with two endpoints:
  * `POST /user` - Create a user
  * `GET /user/{id}` - Load a user
* A DynamoDB table for persisting users

## Deploying to AWS

Before deploying, set your Trace0 API key in `cdk/lib/node-js-lambda-stack.ts`. Find the `OTEL_EXPORTER_OTLP_HEADERS` environment variable and replace `YOUR_TRACE0_ENV_API_KEY` with your API key:

```typescript
OTEL_EXPORTER_OTLP_HEADERS: 'X-API-KEY=abc123',
```

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then deploy the service to your AWS account:

```bash
cd cdk
npm install
npx cdk deploy
```

> Make sure you have the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) installed and your AWS credentials configured before deploying.

## Seeing It in Action

Once the deployment completes, you will see the `ApiUrl` printed in your console:

![Deployment complete](docs/screenshots/deploy-complete-light.png#gh-light-mode-only)
![Deployment complete](docs/screenshots/deploy-complete-dark.png#gh-dark-mode-only)

### Calling the Service

You can then create a new user by sending a `POST` request to the `/users` endpoint:

```bash
curl --location 'https://a09yavehv6.execute-api.eu-west-1.amazonaws.com/dev/users' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "Jon Smith",
    "email": "jon.smith@example.com"
  }'
```

The response body will return a `userId` field, which you can then use to load a user by sending a `GET` request to the `/users/{userId}` endpoint:

```bash
curl --location 'https://a09yavehv6.execute-api.eu-west-1.amazonaws.com/dev/users/usr_1780345326724_bacll9d'
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

To simulate a failing transaction, remove the `dynamodb:GetItem` permission for the users DynamoDB table from the service's IAM policy, then call the `/users/{userId}` endpoint again. The transaction will appear as an error in Trace0, with the full error details and stack trace included:

![Transaction error light mode](docs/screenshots/transaction-error-light.png#gh-light-mode-only)
![Transaction error dark mode](docs/screenshots/transaction-error-dark.png#gh-dark-mode-only)

You can also set up alerts to be notified in real time when an error occurs. See our [Alerts section](https://docs.trace0hq.com/platform/alerts) in our user guide for more details.

### Metrics

You can view metrics for this service by clicking into the `Metrics` section:

![Metrics light mode](docs/screenshots/metrics-light.png#gh-light-mode-only)
![Metrics dark mode](docs/screenshots/metrics-dark.png#gh-dark-mode-only)

See our [Metrics section](https://docs.trace0hq.com/platform/metrics) in our user guide for more details.
