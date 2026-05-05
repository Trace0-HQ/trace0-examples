plugins {
    java
    id("com.gradleup.shadow") version "8.3.6"
}

group = "com.trace0"
version = "1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

val awsSdkVersion = "2.25.0"

dependencies {
    implementation("com.amazonaws:aws-lambda-java-core:1.2.3")
    implementation("com.amazonaws:aws-lambda-java-events:3.13.0")

    implementation("software.amazon.awssdk:dynamodb:$awsSdkVersion")
    runtimeOnly("software.amazon.awssdk:url-connection-client:$awsSdkVersion")

    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0")

    implementation("io.opentelemetry:opentelemetry-api:1.61.0")

    implementation("org.apache.logging.log4j:log4j-api:2.23.1")
    implementation("org.apache.logging.log4j:log4j-core:2.23.1")
    runtimeOnly("org.apache.logging.log4j:log4j-slf4j2-impl:2.23.1")
    runtimeOnly("com.amazonaws:aws-lambda-java-log4j2:1.6.0")
}

tasks.shadowJar {
    archiveBaseName.set("java-lambda")
    archiveClassifier.set("")
    archiveVersion.set("")
    mergeServiceFiles()
    // Merges Log4j plugin cache files from all JARs so plugins are discoverable at runtime.
    transform(com.github.jengelman.gradle.plugins.shadow.transformers.Log4j2PluginsCacheFileTransformer::class.java)
}

tasks.build {
    dependsOn(tasks.shadowJar)
}
