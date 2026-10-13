package com.trace0.javalin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

public class UserController {
    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    private final String jdbcUrl;
    private final String user;
    private final String password;

    public UserController() {
        this.jdbcUrl = System.getenv("POSTGRES_JDBC_URL");
        this.user = System.getenv("POSTGRES_USER");
        this.password = System.getenv("POSTGRES_PASSWORD");

        ensureTableExists();
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(jdbcUrl, user, password);
    }

    // docker-compose's `depends_on` only waits for the postgres *container* to start, not
    // for the Postgres server inside it to finish booting and start accepting connections —
    // so the first connection attempt here can easily lose that race. Retrying with a short
    // delay instead of failing immediately covers that startup window.
    private void ensureTableExists() {
        int maxAttempts = 20;
        long delayMs = 1000;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try (Connection connection = getConnection();
                 var statement = connection.createStatement()) {
                statement.execute("""
                        CREATE TABLE IF NOT EXISTS users (
                            user_id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            email TEXT NOT NULL
                        )
                        """);
                logger.info("Users table ready");
                return;
            } catch (SQLException e) {
                if (attempt == maxAttempts) {
                    logger.error("Postgres never became ready after {} attempts", maxAttempts, e);
                    throw new RuntimeException(e);
                }
                logger.info("Postgres not ready yet (attempt {}/{}), retrying in {}ms...", attempt, maxAttempts, delayMs);
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
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO users (user_id, name, email) VALUES (?, ?, ?)")) {
            statement.setString(1, userId);
            statement.setString(2, request.name());
            statement.setString(3, request.email());
            statement.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
        logger.info("User {} created successfully", userId);
        return new User(userId, request.name(), request.email());
    }

    public User getUser(String userId) {
        logger.info("Loading user with id {}", userId);
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT user_id, name, email FROM users WHERE user_id = ?")) {
            statement.setString(1, userId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    logger.warn("User {} not found", userId);
                    return null;
                }
                return new User(resultSet.getString("user_id"), resultSet.getString("name"), resultSet.getString("email"));
            }
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }

    public User updateUser(String userId, CreateUserRequest request) {
        logger.info("Updating user with id {}", userId);
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "UPDATE users SET name = ?, email = ? WHERE user_id = ?")) {
            statement.setString(1, request.name());
            statement.setString(2, request.email());
            statement.setString(3, userId);
            if (statement.executeUpdate() == 0) {
                logger.warn("User {} not found", userId);
                return null;
            }
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
        logger.info("User {} updated successfully", userId);
        return new User(userId, request.name(), request.email());
    }

    public boolean deleteUser(String userId) {
        logger.info("Deleting user with id {}", userId);
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "DELETE FROM users WHERE user_id = ?")) {
            statement.setString(1, userId);
            if (statement.executeUpdate() == 0) {
                logger.warn("User {} not found", userId);
                return false;
            }
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
        logger.info("User {} deleted successfully", userId);
        return true;
    }
}
