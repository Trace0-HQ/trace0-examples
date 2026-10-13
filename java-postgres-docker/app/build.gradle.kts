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

dependencies {
    implementation("io.javalin:javalin:7.2.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("ch.qos.logback:logback-classic:1.5.6")

    runtimeOnly("org.postgresql:postgresql:42.7.7")
}

tasks.compileJava {
    options.compilerArgs.add("-parameters")
}

tasks.shadowJar {
    archiveBaseName.set("java-postgres-docker")
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
