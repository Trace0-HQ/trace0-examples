package com.example.user;

import java.util.List;

import io.micrometer.observation.annotation.ObservationKeyValue;
import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;

@Service
public class UserService {
    private static final Logger LOGGER = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;

    UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Observed(name = "user.create")
    public User create(long id, String name) {
        LOGGER.info("Creating user '{}'", name);
        return userRepository.save(new User(id, name));
    }

    @Observed(name = "user.list-all")
    public List<User> listAll() {
        LOGGER.info("Listing all users");
        return userRepository.findAll();
    }

    @Observed(name = "user.find-with-id")
    public @Nullable User findWithId(@ObservationKeyValue("id") long id) {
        LOGGER.info("Finding user with id {}", id);
        return userRepository.findById(id).orElse(null);
    }
}
