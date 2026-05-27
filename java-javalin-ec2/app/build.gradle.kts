plugins {
    java
    id("com.gradleup.shadow") version "8.3.6"
}

group = "com.trace0"
version = "1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

val awsSdkVersion = "2.25.0"

dependencies {
    implementation("io.javalin:javalin:7.2.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("ch.qos.logback:logback-classic:1.5.6")

    implementation("software.amazon.awssdk:dynamodb:$awsSdkVersion")
    runtimeOnly("software.amazon.awssdk:url-connection-client:$awsSdkVersion")
}

tasks.compileJava {
    options.compilerArgs.add("-parameters")
}

tasks.shadowJar {
    archiveBaseName.set("java-javalin-ec2")
    archiveClassifier.set("")
    archiveVersion.set("")
    mergeServiceFiles()
    manifest {
        attributes["Main-Class"] = "com.trace0.javalin.Main"
    }
}

tasks.build {
    dependsOn(tasks.shadowJar)
}
