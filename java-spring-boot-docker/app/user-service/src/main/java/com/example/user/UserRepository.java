package com.example.user;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;

@Repository
class UserRepository {

    private final DynamoDbClient dynamoDbClient;
    private final String tableName;

    UserRepository(DynamoDbClient dynamoDbClient, @Value("${users.table.name}") String tableName) {
        this.dynamoDbClient = dynamoDbClient;
        this.tableName = tableName;
    }

    User save(User user) {
        long id = user.id();
        dynamoDbClient.putItem(PutItemRequest.builder()
            .tableName(tableName)
            .item(Map.of(
                "id",   AttributeValue.fromN(String.valueOf(id)),
                "name", AttributeValue.fromS(user.name())
            ))
            .build());
        return user;
    }

    List<User> findAll() {
        return dynamoDbClient.scan(ScanRequest.builder().tableName(tableName).build())
            .items()
            .stream()
            .map(item -> new User(Long.parseLong(item.get("id").n()), item.get("name").s()))
            .toList();
    }

    Optional<User> findById(long id) {
        var response = dynamoDbClient.getItem(GetItemRequest.builder()
            .tableName(tableName)
            .key(Map.of("id", AttributeValue.fromN(String.valueOf(id))))
            .build());
        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }
        var item = response.item();
        return Optional.of(new User(Long.parseLong(item.get("id").n()), item.get("name").s()));
    }
}
