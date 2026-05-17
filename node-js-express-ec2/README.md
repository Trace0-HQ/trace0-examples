# Node.js Express EC2 Example

A `Node.js` `Express` service deployed on an EC2 instance, with Trace0 installed for observability. The service includes:

* Two HTTP endpoints on port 3000:
  * `POST /users` - Create a user
  * `GET /users/:userId` - Load a user
* A `DynamoDB` table for persisting users

## Deploying to AWS

Before deploying, set your Trace0 API key in `cdk/lib/stack.ts`. Find the `OTEL_EXPORTER_OTLP_HEADERS` environment variable and replace `YOUR_TRACE0_ENV_API_KEY` with your API key:

```typescript
Environment="OTEL_EXPORTER_OTLP_HEADERS=X-API-KEY=YOUR_TRACE0_ENV_API_KEY"
```

You can find your API key by clicking **Environment Settings** in the [Trace0 dashboard](https://app.trace0hq.com/).

Then deploy the service to your AWS account:

```bash
cd cdk
npm install
npx cdk deploy
```

CDK will compile the TypeScript app locally, upload it to S3, and provision the EC2 instance. The API URL is printed as an output when the deployment completes.

> Make sure you have the [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) installed, your AWS credentials configured, and Node.js installed locally before deploying.
