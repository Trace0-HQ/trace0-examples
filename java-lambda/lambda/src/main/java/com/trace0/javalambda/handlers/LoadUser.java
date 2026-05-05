package com.trace0.javalambda.handlers;

import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trace0.javalambda.Response;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;

import java.util.Map;

public class LoadUser {

    private static final Logger logger = LogManager.getLogger(LoadUser.class);
    private static final DynamoDbClient dynamo = DynamoDbClient.create();
    private static final String TABLE_NAME = System.getenv("USERS_TABLE_NAME");
    private static final ObjectMapper mapper = new ObjectMapper();

    public APIGatewayProxyResponseEvent handle(APIGatewayProxyRequestEvent event) {
        Map<String, String> pathParams = event.getPathParameters();
        String userId = pathParams != null ? pathParams.get("userId") : null;
        if (userId == null) {
            return Response.json(400, "{\"error\":\"userId path parameter is required\"}");
        }

        logger.info("Loading user with id: {}", userId);

        GetItemResponse result;
        try {
            result = dynamo.getItem(GetItemRequest.builder()
                    .tableName(TABLE_NAME)
                    .key(Map.of("userId", AttributeValue.fromS(userId)))
                    .build());
        } catch (Exception e) {
            logger.error("Failed to load user", e);
            return Response.json(500, "{\"error\":\"Internal server error\"}");
        }

        if (!result.hasItem() || result.item().isEmpty()) {
            logger.error("User not found with id: {}", userId);
            return Response.json(404, "{\"error\":\"User not found\"}");
        }

        Map<String, AttributeValue> item = result.item();
        Map<String, String> user = Map.of(
                "userId", item.get("userId").s(),
                "name", item.get("name").s(),
                "email", item.get("email").s(),
                "createdAt", item.get("createdAt").s()
        );

        logger.info("User loaded successfully with id: {}", userId);
        try {
            return Response.json(200, mapper.writeValueAsString(user));
        } catch (Exception e) {
            return Response.json(500, "{\"error\":\"Internal server error\"}");
        }
    }
}
