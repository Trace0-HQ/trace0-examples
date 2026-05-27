package com.trace0.javalin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.util.Map;
import java.util.UUID;

public class UserController {
    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    private final DynamoDbClient dynamoDb;
    private final String tableName;

    public UserController() {
        this.tableName = System.getenv("USERS_TABLE_NAME");
        String region = System.getenv().getOrDefault("AWS_REGION", "eu-west-1");
        this.dynamoDb = DynamoDbClient.builder()
                .region(Region.of(region))
                .build();
    }

    public User createUser(CreateUserRequest request) {
        String userId = UUID.randomUUID().toString();
        logger.info("Creating user with id {}", userId);
        dynamoDb.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(Map.of(
                        "userId", AttributeValue.fromS(userId),
                        "name", AttributeValue.fromS(request.name()),
                        "email", AttributeValue.fromS(request.email())
                ))
                .build());
        logger.info("User {} created successfully", userId);
        return new User(userId, request.name(), request.email());
    }

    public User getUser(String userId) {
        logger.info("Loading user with id {}", userId);
        var response = dynamoDb.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("userId", AttributeValue.fromS(userId)))
                .build());
        if (!response.hasItem() || response.item().isEmpty()) {
            logger.warn("User {} not found", userId);
            return null;
        }
        var item = response.item();
        return new User(
                item.get("userId").s(),
                item.get("name").s(),
                item.get("email").s()
        );
    }
}
