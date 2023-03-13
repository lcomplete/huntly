package com.huntly.server.service;

import com.huntly.common.exceptions.BusinessException;
import com.huntly.interfaces.external.model.LoginRequest;
import com.huntly.server.domain.entity.User;
import com.huntly.server.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * @author lcomplete
 */
@Service
public class UserService {
    private final UserRepository userRepository;

    private final PasswordEncoder encoder;

    public UserService(UserRepository userRepository, PasswordEncoder encoder) {
        this.userRepository = userRepository;
        this.encoder = encoder;
    }

    public User createUser(String username, String password) {
        var users = userRepository.findAll();
        if (!users.isEmpty()) {
            throw new BusinessException("just support one user for now");
        }

        var user = new User();
        user.setUsername(username);
        user.setPassword(encoder.encode(password));
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(Instant.now());
        return userRepository.save(user);
    }

    public void updateLastLoginAt(String username) {
        userRepository.findByUsername(username).ifPresent(user->{
            user.setLastLoginAt(Instant.now());
            userRepository.save(user);
        });
    }

    public Boolean isUserSet() {
        return !userRepository.findAll().isEmpty();
    }

    public void updateLoginUser(LoginRequest loginRequest, String currentUsername) {
        userRepository.findByUsername(currentUsername).ifPresent(user->{
            user.setUsername(loginRequest.getUsername());
            user.setPassword(encoder.encode(loginRequest.getPassword()));
            user.setUpdatedAt(Instant.now());
            userRepository.save(user);
        });
    }
}
