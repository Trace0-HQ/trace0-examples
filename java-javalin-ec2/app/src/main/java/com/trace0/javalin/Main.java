package com.trace0.javalin;

import io.javalin.Javalin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public class Main {
    private static final Logger logger = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) {
        var userController = new UserController();

        Javalin.create(config -> {
            config.routes.post("/users", ctx -> {
                var request = ctx.bodyAsClass(CreateUserRequest.class);
                var user = userController.createUser(request);
                ctx.status(201).json(user);
            });

            config.routes.get("/users/{userId}", ctx -> {
                var userId = ctx.pathParam("userId");
                var user = userController.getUser(userId);
                if (user == null) {
                    ctx.status(404).json(Map.of("detail", "User not found"));
                    return;
                }
                ctx.json(user);
            });

            config.routes.exception(Exception.class, (e, ctx) -> {
                logger.error("Unhandled exception on {} {}", ctx.method(), ctx.path(), e);
                ctx.status(500).json(Map.of("detail", "Internal server error"));
            });

        }).start(8000);
    }
}
