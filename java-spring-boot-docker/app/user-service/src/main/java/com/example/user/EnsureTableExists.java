package com.example.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeDefinition;
import software.amazon.awssdk.services.dynamodb.model.BillingMode;
import software.amazon.awssdk.services.dynamodb.model.CreateTableRequest;
import software.amazon.awssdk.services.dynamodb.model.KeySchemaElement;
import software.amazon.awssdk.services.dynamodb.model.KeyType;
import software.amazon.awssdk.services.dynamodb.model.ResourceInUseException;
import software.amazon.awssdk.services.dynamodb.model.ScalarAttributeType;

// docker-compose's `depends_on` only waits for the dynamodb-local *container* to
// start, not for its JVM to actually finish booting and listening on port 8000 —
// so the first connection attempt can easily lose that race. Retrying with a
// short delay covers that startup window. Runs before CreateUsers (which seeds
// data into the table this creates) via HIGHEST_PRECEDENCE ordering.
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class EnsureTableExists implements CommandLineRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(EnsureTableExists.class);
    private static final int MAX_ATTEMPTS = 20;
    private static final long DELAY_MS = 1000;

    private final DynamoDbClient dynamoDbClient;
    private final String tableName;

    EnsureTableExists(DynamoDbClient dynamoDbClient, @Value("${users.table.name}") String tableName) {
        this.dynamoDbClient = dynamoDbClient;
        this.tableName = tableName;
    }

    @Override
    public void run(String... args) throws InterruptedException {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                dynamoDbClient.createTable(CreateTableRequest.builder()
                    .tableName(tableName)
                    .attributeDefinitions(AttributeDefinition.builder()
                        .attributeName("id")
                        .attributeType(ScalarAttributeType.N)
                        .build())
                    .keySchema(KeySchemaElement.builder()
                        .attributeName("id")
                        .keyType(KeyType.HASH)
                        .build())
                    .billingMode(BillingMode.PAY_PER_REQUEST)
                    .build());
                LOGGER.info("Created table {}", tableName);
                return;
            } catch (ResourceInUseException e) {
                return;
            } catch (Exception e) {
                if (attempt == MAX_ATTEMPTS) {
                    throw new IllegalStateException(
                        "Failed to connect to DynamoDB after " + MAX_ATTEMPTS + " attempts", e);
                }
                LOGGER.info("DynamoDB not ready yet (attempt {}/{}), retrying in {}ms...",
                    attempt, MAX_ATTEMPTS, DELAY_MS);
                Thread.sleep(DELAY_MS);
            }
        }
    }
}
