package com.example.user;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
class UserController {
    private final UserService userService;

    private final Delay delay;

    UserController(UserService userService, Delay delay) {
        this.userService = userService;
        this.delay = delay;
    }

    @GetMapping({"", "/"})
    List<User> all() {
        this.delay.delay();
        return this.userService.listAll();
    }

    @GetMapping({"/{id}",})
    ResponseEntity<User> findById(@PathVariable Long id) throws Exception {
        this.delay.delay();
        User user = this.userService.findWithId(id);
        if (user == null) {
            throw new Exception("User with id: " + id + " not found.");
        }
        return ResponseEntity.ok(user);
    }

}
