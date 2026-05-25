# Python FastAPI EC2 Example

A Python FastAPI service deployed on an EC2 instance, with Trace0 installed for observability. The service includes:

* Two HTTP endpoints on port 8000:
  * `POST /users` - Create a user
  * `GET /users/{userId}` - Load a user
* A DynamoDB table for persisting users

## Observability

Observability is provided by the [OpenTelemetry Python auto-instrumentation agent](https://opentelemetry.io/docs/zero-code/python/). The agent is launched via `opentelemetry-instrument` as the service entry point, which wraps `uvicorn` and automatically instruments FastAPI, boto3/botocore (DynamoDB), and the standard HTTP libraries — no changes to application code required.

`opentelemetry-bootstrap -a install` is run during EC2 setup to detect installed packages and install the matching OTel instrumentation libraries. Configuration is provided entirely via environment variables set in the systemd unit.

`OTEL_PYTHON_LOG_CORRELATION=true` injects the active trace and span IDs into log records, enabling log-trace correlation in Trace0.

## Deploying to AWS

Before deploying, set your Trace0 API key in `cdk/lib/stack.ts`. Replace `YOUR_TRACE0_ENV_API_KEY` with your API key in the `OTEL_EXPORTER_OTLP_HEADERS` environment variable.

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then deploy the service to your AWS account:

```bash
cd cdk
npm install
npx cdk deploy
```

CDK will upload the app files to S3 and provision the EC2 instance. On first boot, the instance installs Python dependencies and starts the service via systemd. The API URL is printed as `ApiUrl` when the deployment completes.

> Make sure you have the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) installed and your AWS credentials configured before deploying.
