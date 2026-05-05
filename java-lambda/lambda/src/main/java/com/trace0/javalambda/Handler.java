package com.trace0.javalambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.trace0.javalambda.handlers.LoadUser;
import com.trace0.javalambda.handlers.StoreUser;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class Handler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

    private static final Logger logger = LogManager.getLogger(Handler.class);

    private final StoreUser storeUser = new StoreUser();
    private final LoadUser loadUser = new LoadUser();

    @Override
    public APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent event, Context context) {
        String httpMethod = event.getHttpMethod();
        String path = event.getPath();
        String requestId = event.getRequestContext() != null ? event.getRequestContext().getRequestId() : "";

        logger.info("Request received method={} path={} requestId={} lambdaRequestId={}",
                httpMethod, path, requestId, context.getAwsRequestId());

        // Enrich the active Lambda invocation span with HTTP request attributes.
        // These are not set automatically by the OTel Lambda auto-instrumentation
        // for lambdas triggered via API Gateway.
        Span span = Span.current();
        span.setAttribute("http.request.method", httpMethod);
        span.setAttribute("http.route", path);

        try {
            APIGatewayProxyResponseEvent result;
            if ("POST".equals(httpMethod) && "/users".equals(path)) {
                result = storeUser.handle(event);
            } else if ("GET".equals(httpMethod) && path != null && path.matches("^/users/[^/]+$")) {
                result = loadUser.handle(event);
            } else {
                result = Response.json(404, "{\"error\":\"Route not found: " + httpMethod + " " + path + "\"}");
            }

            logger.info("Request completed method={} path={} statusCode={}",
                    httpMethod, path, result.getStatusCode());

            span.setAttribute("http.response.status_code", result.getStatusCode());
            span.setStatus(result.getStatusCode() < 400 ? StatusCode.OK : StatusCode.ERROR);
            return result;

        } catch (Exception e) {
            logger.error("Unhandled error", e);
            span.setAttribute("http.response.status_code", 500);
            span.setStatus(StatusCode.ERROR);
            return Response.json(500, "{\"error\":\"Internal server error\"}");
        }
    }
}
