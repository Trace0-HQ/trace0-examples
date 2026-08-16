package com.example.user;

import java.net.URI;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.instrumentation.awssdk.v2_2.AwsSdkTelemetry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

@Configuration
class DynamoDbConfig {

    @Bean
    DynamoDbClient dynamoDbClient(
            @Value("${aws.region:eu-west-1}") String region,
            @Value("${aws.dynamodb.endpoint:}") String endpointOverride,
            OpenTelemetry openTelemetry) {
        AwsSdkTelemetry telemetry = AwsSdkTelemetry.create(openTelemetry);
        var builder = DynamoDbClient.builder()
            .region(Region.of(region))
            .overrideConfiguration(ClientOverrideConfiguration.builder()
                .addExecutionInterceptor(telemetry.newExecutionInterceptor())
                .build());

        // DynamoDB Local doesn't validate credentials, but the SDK still needs a
        // credentials provider to resolve successfully — these dummy values satisfy
        // that without needing real AWS credentials.
        if (!endpointOverride.isBlank()) {
            builder = builder
                .endpointOverride(URI.create(endpointOverride))
                .credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("local", "local")));
        }

        return builder.build();
    }
}
