ARG JAVA_VERSION=25

FROM amazoncorretto:${JAVA_VERSION} AS builder
WORKDIR /workspace
# The Gradle wrapper script shells out to xargs, which this base image doesn't
# include by default.
RUN dnf install -y findutils && dnf clean all
COPY . .
RUN chmod +x gradlew && ./gradlew :hello-service:bootJar :user-service:bootJar :greeting-service:bootJar --no-daemon

FROM amazoncorretto:${JAVA_VERSION} AS hello-service
WORKDIR /app
COPY --from=builder /workspace/hello-service/build/libs/*.jar app.jar
EXPOSE 8090
ENTRYPOINT ["java", "-Xmx350m", "-jar", "app.jar"]

FROM amazoncorretto:${JAVA_VERSION} AS user-service
WORKDIR /app
COPY --from=builder /workspace/user-service/build/libs/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-Xmx350m", "-jar", "app.jar"]

FROM amazoncorretto:${JAVA_VERSION} AS greeting-service
WORKDIR /app
COPY --from=builder /workspace/greeting-service/build/libs/*.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-Xmx350m", "-jar", "app.jar"]
