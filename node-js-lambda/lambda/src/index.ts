import { trace, SpanStatusCode } from '@opentelemetry/api';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { storeUser } from './handlers/storeUser';
import { loadUser } from './handlers/loadUser';
import logger from './logger.js';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { httpMethod, path, requestContext } = event;

  logger.info(
  {
    method: httpMethod,
    path,
    requestId: requestContext.requestId,
    lambdaRequestId: context.awsRequestId,
  },
  'Request received'
);

  // Enrich the active Lambda invocation span with HTTP request attributes.
  // These are not set automatically by the OTel Lambda auto-instrumentation
  // for lambdas triggered via API Gateway.
  const span = trace.getActiveSpan();
  span?.setAttributes({
    'http.request.method': event.httpMethod,
    'http.route': event.path
  });

  try {
    let result: APIGatewayProxyResult;

    if (httpMethod === 'POST' && path === '/users') {
      result = await storeUser(event);
    } else if (httpMethod === 'GET' && path.match(/^\/users\/[^/]+$/)) {
      result = await loadUser(event);
    } else {
      result = {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Route not found: ${httpMethod} ${path}` }),
      };
    }

    logger.info(`Request completed method=${httpMethod} path=${path} statusCode=${result.statusCode}`);

    // Set the HTTP response code and mark the span as failed for 4xx/5xx responses.
    span?.setAttributes({ 'http.response.status_code': result.statusCode });
    span?.setStatus({ code: result.statusCode < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR });

    return result;
  } catch (err) {
    const error = err as Error;
    logger.error({ err: error }, 'Unhandled error');
    // Set the HTTP response code to 500 and mark the span as failed.
    span?.setAttributes({ 'http.response.status_code': 500 });
    span?.setStatus({ code: SpanStatusCode.ERROR });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
