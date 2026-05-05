package com.trace0.javalambda.model;

public class User {
    private String userId;
    private String name;
    private String email;
    private String createdAt;

    public User() {}

    public User(String userId, String name, String email, String createdAt) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.createdAt = createdAt;
    }

    public String getUserId() { return userId; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getCreatedAt() { return createdAt; }

    public void setUserId(String userId) { this.userId = userId; }
    public void setName(String name) { this.name = name; }
    public void setEmail(String email) { this.email = email; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
