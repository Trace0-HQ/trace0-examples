ARG OTEL_AGENT_VERSION=2.30.0

FROM amazoncorretto:21-alpine
ARG OTEL_AGENT_VERSION

# OpenTelemetry Java agent - zero-code instrumentation attached at JVM startup via -javaagent.
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar /opt/opentelemetry-javaagent.jar

# Fat JAR is built locally by CDK (./gradlew shadowJar) before the Docker build runs.
COPY build/libs/java-javalin-ecs.jar /opt/app.jar

EXPOSE 8000

ENTRYPOINT ["java", "-javaagent:/opt/opentelemetry-javaagent.jar", "-Xmx700m", "-jar", "/opt/app.jar"]
