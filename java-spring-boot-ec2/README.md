# Spring Boot Java Example

> This example is based on the [spring-boot-and-opentelemetry](https://github.com/mhalbritter/spring-boot-and-opentelemetry) sample project, modified to replace the H2 in-memory database with DynamoDB and to add the [AWS SDK v2 OpenTelemetry instrumentation library](https://github.com/open-telemetry/opentelemetry-java-instrumentation/tree/main/instrumentation/aws-sdk/aws-sdk-2.2/library) to instrument DynamoDB calls.

---

This example app consists of three Java Spring Boot services deployed on a single EC2 instance, with Trace0 installed for observability. The services are:

* `hello-service` (port 8090) — public entry point. Accepts requests and calls `user-service` and `greeting-service` to compose a response.
* `user-service` (port 8081) — manages users backed by a DynamoDB table.
* `greeting-service` (port 8082) — returns localised greetings.

The hello-service exposes one public endpoint:

* `GET /api/{userId}` — returns a greeting for the given user.

## Observability

Each service uses `spring-boot-starter-opentelemetry` and `spring-boot-starter-micrometer-metrics` to export traces, metrics, and logs to Trace0 via OTLP. The OTel Logback appender (`opentelemetry-logback-appender-1.0`) is wired in each service's `logback-spring.xml` so that log records carry the active trace and span IDs.

The `user-service` additionally instruments its DynamoDB client using the [AWS SDK v2 OpenTelemetry instrumentation library](https://github.com/open-telemetry/opentelemetry-java-instrumentation/tree/main/instrumentation/aws-sdk/aws-sdk-2.2/library). The interceptor is registered manually on the client (in [DynamoDbConfig](app/user-service/src/main/java/com/example/user/DynamoDbConfig.java)) so that it uses the Spring-managed `OpenTelemetry` instance:

```java
AwsSdkTelemetry telemetry = AwsSdkTelemetry.create(openTelemetry);
DynamoDbClient.builder()
    .overrideConfiguration(ClientOverrideConfiguration.builder()
        .addExecutionInterceptor(telemetry.newExecutionInterceptor())
        .build())
    .build();
```

## Deploying to AWS

Before deploying, set your Trace0 API key in each service's `application.properties` file. Replace `YOUR_TRACE0_ENV_API_KEY` with your API key in all three properties:

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

Then deploy the services to your AWS account:

```bash
cd cdk
npm install
npx cdk deploy
```

The CDK will build all three JARs locally, upload them to S3, and provision the EC2 instance. Each service runs as a systemd unit. The public URL for the `hello-service` is printed as `ApiUrl` when the deployment completes.

> Make sure you have the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) installed, your AWS credentials configured, and JDK 25 installed locally before deploying.

## Seeing It in Action

Once the deployment completes, you will see the `ApiUrl` printed in your console:

![Deployment complete](docs/screenshots/deploy-complete-light.png#gh-light-mode-only)
![Deployment complete](docs/screenshots/deploy-complete-dark.png#gh-dark-mode-only)

### Calling the Service

You can load a user by sending a `GET` request to the `/api/{userId}` endpoint:

```bash
curl --location 'http://ec2-18-203-153-123.eu-west-1.compute.amazonaws.com:8090/api/1'
```

```bash
curl --location 'http://ec2-18-203-153-123.eu-west-1.compute.amazonaws.com:8090/api/2'
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

To simulate a failing transaction, remove the `dynamodb:GetItem` permission for the users DynamoDB table from the `user-service` IAM policy, then call the `/api/{userId}` endpoint again. The transaction will appear as an error in Trace0, with the full error details and stack trace included:

![Transaction error light mode](docs/screenshots/transaction-error-light.png#gh-light-mode-only)
![Transaction error dark mode](docs/screenshots/transaction-error-dark.png#gh-dark-mode-only)

You can also set up alerts to be notified in real time when an error occurs. See our [Alerts section](https://docs.trace0hq.com/platform/alerts) in our user guide for more details.

### Metrics

You can view metrics for each service by clicking into the `Metrics` section:

![Metrics light mode](docs/screenshots/metrics-light.png#gh-light-mode-only)
![Metrics dark mode](docs/screenshots/metrics-dark.png#gh-dark-mode-only)

See our [Metrics section](https://docs.trace0hq.com/platform/metrics) in our user guide for more details.
