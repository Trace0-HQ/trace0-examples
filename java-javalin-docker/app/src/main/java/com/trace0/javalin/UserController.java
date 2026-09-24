package com.trace0.javalin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeDefinition;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.BillingMode;
import software.amazon.awssdk.services.dynamodb.model.CreateTableRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.KeySchemaElement;
import software.amazon.awssdk.services.dynamodb.model.KeyType;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.ResourceInUseException;
import software.amazon.awssdk.services.dynamodb.model.ScalarAttributeType;

import java.net.URI;
import java.util.Map;
import java.util.UUID;

public class UserController {
    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    private final DynamoDbClient dynamoDb;
    private final String tableName;

    public UserController() {
        this.tableName = System.getenv("USERS_TABLE_NAME");
        String region = System.getenv().getOrDefault("AWS_REGION", "local");
        String endpoint = System.getenv("DYNAMODB_ENDPOINT");

        var builder = DynamoDbClient.builder().region(Region.of(region));
        if (endpoint != null && !endpoint.isBlank()) {
            // DynamoDB Local doesn't validate credentials, but the SDK still needs a
            // credentials provider to resolve successfully before it'll make requests.
            builder.endpointOverride(URI.create(endpoint))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create("local", "local")));
        }
        this.dynamoDb = builder.build();

        ensureTableExists();
    }

    // DynamoDB Local starts empty on every container run (it's in-memory — see
    // docker-compose.yml), so the table needs to be (re-)created on startup.
    //
    // docker-compose's `depends_on` only waits for the dynamodb-local *container*
    // to start, not for its JVM to finish booting and actually start listening on
    // 8000 — so the first connection attempt here can easily lose that race.
    // Retrying with a short delay instead of failing immediately covers that
    // startup window.
    private void ensureTableExists() {
        int maxAttempts = 20;
        long delayMs = 1000;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                dynamoDb.createTable(CreateTableRequest.builder()
                        .tableName(tableName)
                        .attributeDefinitions(AttributeDefinition.builder()
                                .attributeName("userId")
                                .attributeType(ScalarAttributeType.S)
                                .build())
                        .keySchema(KeySchemaElement.builder()
                                .attributeName("userId")
                                .keyType(KeyType.HASH)
                                .build())
                        .billingMode(BillingMode.PAY_PER_REQUEST)
                        .build());
                logger.info("Created table {}", tableName);
                return;
            } catch (ResourceInUseException e) {
                return;
            } catch (RuntimeException e) {
                if (attempt == maxAttempts) {
                    logger.error("DynamoDB Local never became ready after {} attempts", maxAttempts, e);
                    throw e;
                }
                logger.info("DynamoDB Local not ready yet (attempt {}/{}), retrying in {}ms...", attempt, maxAttempts, delayMs);
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException(ie);
                }
            }
        }
    }

    public User createUser(CreateUserRequest request) {
        if ("trigger-error@example.com".equals(request.email())) {
            throw new IllegalArgumentException("Invalid email address: " + request.email() + ".");
        }

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
