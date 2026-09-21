import json
import logging
import re

from opentelemetry import trace
from opentelemetry.trace import StatusCode

from logger import configure_logging
from handlers.store_user import store_user
from handlers.load_user import load_user

logger = logging.getLogger(__name__)


def handler(event, context):
    # Re-attaches our own handler on each invocation, since the Lambda runtime re-attaches
    # its own plain-text handler every time (not just at lambda start up).
    configure_logging()

    http_method = event.get('httpMethod', '')
    path = event.get('path', '')
    request_id = event.get('requestContext', {}).get('requestId', '')

    logger.info(
        f"Request received method={http_method} path={path} "
        f"requestId={request_id} lambdaRequestId={context.aws_request_id}"
    )

    # Enrich the active Lambda invocation span with HTTP request attributes.
    # These are not set automatically by the OTel Lambda auto-instrumentation
    # for lambdas triggered via API Gateway.
    span = trace.get_current_span()
    span.set_attributes({
        'http.request.method': http_method,
        'http.route': path,
    })

    try:
        if http_method == 'POST' and path == '/users':
            result = store_user(event)
        elif http_method == 'GET' and re.match(r'^/users/[^/]+$', path):
            result = load_user(event)
        else:
            result = {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Route not found: {http_method} {path}'}),
            }

        logger.info(
            f"Request completed method={http_method} path={path} statusCode={result['statusCode']}"
        )

        # Set the HTTP response code and mark the span as failed for 4xx/5xx responses.
        status_code = result['statusCode']
        span.set_attribute('http.response.status_code', status_code)
        span.set_status(StatusCode.OK if status_code < 400 else StatusCode.ERROR)

        return result

    except Exception as e:
        logger.error('Unhandled error', exc_info=True)
        span.record_exception(e)
        span.set_attribute('http.response.status_code', 500)
        span.set_status(StatusCode.ERROR)
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'}),
        }
