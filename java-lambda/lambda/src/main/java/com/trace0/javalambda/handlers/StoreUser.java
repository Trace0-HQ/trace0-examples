package com.trace0.javalambda.handlers;

import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trace0.javalambda.Response;
import com.trace0.javalambda.model.User;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public class StoreUser {

    private static final Logger logger = LogManager.getLogger(StoreUser.class);
    private static final DynamoDbClient dynamo = DynamoDbClient.create();
    private static final String TABLE_NAME = System.getenv("USERS_TABLE_NAME");
    private static final ObjectMapper mapper = new ObjectMapper();

    public APIGatewayProxyResponseEvent handle(APIGatewayProxyRequestEvent event) {
        if (event.getBody() == null || event.getBody().isBlank()) {
            return Response.json(400, "{\"error\":\"Request body is required\"}");
        }

        Map<?, ?> body;
        try {
            body = mapper.readValue(event.getBody(), Map.class);
        } catch (Exception e) {
            return Response.json(400, "{\"error\":\"Invalid JSON body\"}");
        }

        String name = (String) body.get("name");
        String email = (String) body.get("email");
        if (name == null || email == null) {
            return Response.json(400, "{\"error\":\"name and email are required\"}");
        }

        String userId = "usr_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 7);
        User user = new User(userId, name, email, Instant.now().toString());

        logger.info("Storing user with id: {}", userId);

        try {
            dynamo.putItem(PutItemRequest.builder()
                    .tableName(TABLE_NAME)
                    .item(Map.of(
                            "userId", AttributeValue.fromS(user.getUserId()),
                            "name", AttributeValue.fromS(user.getName()),
                            "email", AttributeValue.fromS(user.getEmail()),
                            "createdAt", AttributeValue.fromS(user.getCreatedAt())
                    ))
                    .build());
        } catch (Exception e) {
            logger.error("Failed to store user", e);
            return Response.json(500, "{\"error\":\"Internal server error\"}");
        }

        logger.info("User stored successfully with id: {}", userId);
        try {
            return Response.json(201, mapper.writeValueAsString(user));
        } catch (Exception e) {
            return Response.json(500, "{\"error\":\"Internal server error\"}");
        }
    }
}
