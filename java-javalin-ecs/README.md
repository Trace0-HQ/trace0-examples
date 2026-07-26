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

### Calling the Service

You can create a new user by sending a `POST` request to the `/users` endpoint:

```bash
curl --location 'http://<ApiUrl>/users' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "Jon Smith",
    "email": "jon.smith@example.com"
  }'
```

The response body will return a `userId` field, which you can then use to load a user by sending a `GET` request to the `/users/{userId}` endpoint:

```bash
curl --location 'http://<ApiUrl>/users/8b258bc7-3d48-4ee8-929e-0014762b0163'
```

### Errors

To simulate a failing transaction, remove the `dynamodb:GetItem` permission for the users DynamoDB table from the task role, then call the `/users/{userId}` endpoint again. The transaction will appear as an error in Trace0, with the full error details and stack trace included.
