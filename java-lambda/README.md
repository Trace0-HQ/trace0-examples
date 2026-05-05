# AWS Lambda Java Example

A Java service deployed on AWS Lambda, with Trace0 installed for observability. The service includes:

* An API Gateway with two endpoints:
  * `POST /users` - Create a user
  * `GET /users/{userId}` - Load a user
* A DynamoDB table for persisting users

## Deploying to AWS

Before deploying, set your Trace0 API key in `cdk/lib/stack.ts`. Find the `OTEL_EXPORTER_OTLP_HEADERS` environment variable and replace `YOUR_TRACE0_ENV_API_KEY` with your API key:

```typescript
OTEL_EXPORTER_OTLP_HEADERS: 'X-API-KEY=abc123',
```

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then deploy:

```bash
cd cdk
npm install
npx cdk deploy
```

> Make sure you have the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) installed and your AWS credentials configured before deploying.