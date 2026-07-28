# Java Javalin ECS Example

A Java service running as an ECS Fargate task, using the [Javalin](https://javalin.io/) web framework, with Trace0 installed for observability. The service includes:

* Three HTTP endpoints on port 8000:
  * `GET /health` - Health check used by the Application Load Balancer
  * `POST /users` - Create a user
  * `GET /users/{userId}` - Load a user
* A DynamoDB table for persisting users

## Observability

The service uses the [OpenTelemetry Java agent](https://opentelemetry.io/docs/zero-code/java/agent/) for zero-code instrumentation. The agent is baked into the container image (see `app/Dockerfile`) and attached at JVM startup via `-javaagent`, automatically instrumenting Javalin HTTP handlers, DynamoDB calls, and the JVM itself — exporting traces, metrics, and logs to Trace0 via OTLP.

## Deploying to AWS

Before deploying, set your Trace0 API key in `cdk/lib/stack.ts`. Replace `YOUR_TRACE0_ENV_API_KEY` with your API key in the `OTEL_EXPORTER_OTLP_HEADERS` environment variable.

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then deploy to your AWS account:

```bash
cd cdk
npm install
npx cdk deploy
```

CDK builds the container image locally (running `./gradlew shadowJar` as part of the Docker build), pushes it to ECR, and provisions the VPC, ECS cluster, Fargate service, and ALB. The public URL is printed as `ApiUrl` when the deployment completes.

> Make sure you have the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) installed, your AWS credentials configured, Docker running, and JDK 21 installed locally before deploying.

## Seeing It in Action

Once the deployment completes, you will see the `ApiUrl` printed in your console:

![Deployment complete](docs/screenshots/deploy-complete-light.png#gh-light-mode-only)
![Deployment complete](docs/screenshots/deploy-complete-dark.png#gh-dark-mode-only)

### Calling the Service

You can then create a new user by sending a `POST` request to the `/users` endpoint:

```bash
curl --location 'http://JavaJa-Servi-5LAdtgi6yfa0-27220979.eu-west-1.elb.amazonaws.com/users' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "Jon Smith",
    "email": "jon.smith@example.com"
  }'
```

The response body will return a `userId` field, which you can then use to load a user by sending a `GET` request to the `/users/{userId}` endpoint:

```bash
curl --location 'http://JavaJa-Servi-5LAdtgi6yfa0-27220979.eu-west-1.elb.amazonaws.com/users/9d4ef081-c9fa-4681-bec6-106d8e7a092f'
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

To simulate a failing transaction, remove the `dynamodb:GetItem` permission for the users DynamoDB table from the service's ECS task IAM role, then call the `/users/{userId}` endpoint again. The transaction will appear as an error in Trace0, with the full error details and stack trace included:

![Transaction error light mode](docs/screenshots/transaction-error-light.png#gh-light-mode-only)
![Transaction error dark mode](docs/screenshots/transaction-error-dark.png#gh-dark-mode-only)

You can also set up alerts to be notified in real time when an error occurs. See our [Alerts section](https://docs.trace0hq.com/platform/alerts) in our user guide for more details.

### Metrics

You can view metrics for this service by clicking into the `Metrics` section:

![Metrics light mode](docs/screenshots/metrics-light.png#gh-light-mode-only)
![Metrics dark mode](docs/screenshots/metrics-dark.png#gh-dark-mode-only)

See our [Metrics section](https://docs.trace0hq.com/platform/metrics) in our user guide for more details.
