# Java Javalin EC2 Example

A Java service deployed on an EC2 instance, using the [Javalin](https://javalin.io/) web framework, with Trace0 installed for observability. The service includes:

* Two HTTP endpoints on port 8000:
  * `POST /users` - Create a user
  * `GET /users/{userId}` - Load a user
* A DynamoDB table for persisting users

## Observability

The service uses the [OpenTelemetry Java agent](https://opentelemetry.io/docs/zero-code/java/agent/) for zero-code instrumentation. The agent is attached at JVM startup via `-javaagent` and automatically instruments Javalin HTTP handlers, DynamoDB calls, and the JVM itself — exporting traces, metrics, and logs to Trace0 via OTLP.

## Deploying to AWS

Before deploying, set your Trace0 API key in `cdk/lib/stack.ts`. Replace `YOUR_TRACE0_ENV_API_KEY` with your API key in the `OTEL_EXPORTER_OTLP_HEADERS` environment variable.

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then deploy to your AWS account:

```bash
cd cdk
npm install
npx cdk deploy
```

The CDK builds the fat JAR locally, uploads it to S3, and provisions the EC2 instance. The public URL is printed as `ApiUrl` when the deployment completes.

> Make sure you have the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) installed, your AWS credentials configured, and JDK 21 installed locally before deploying.
