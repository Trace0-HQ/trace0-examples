package com.example.user;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.instrumentation.awssdk.v2_2.AwsSdkTelemetry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

@Configuration
class DynamoDbConfig {

    @Bean
    DynamoDbClient dynamoDbClient(@Value("${aws.region:eu-west-1}") String region, OpenTelemetry openTelemetry) {
        AwsSdkTelemetry telemetry = AwsSdkTelemetry.create(openTelemetry);
        return DynamoDbClient.builder()
            .region(Region.of(region))
            .overrideConfiguration(ClientOverrideConfiguration.builder()
                .addExecutionInterceptor(telemetry.newExecutionInterceptor())
                .build())
            .build();
    }
}
