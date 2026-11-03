package com.rhr.intellicore.web;

import com.rhr.intellicore.dto.Dtos.*;
import com.rhr.intellicore.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @PostMapping("/otp/request")
    public OtpChallenge requestOtp(@Valid @RequestBody OtpRequest req) {
        return auth.requestOtp(req);
    }

    @PostMapping("/otp/verify")
    public AuthResponse verifyOtp(@Valid @RequestBody OtpVerifyRequest req) {
        return auth.verifyOtp(req);
    }

    @GetMapping("/me")
    public UserView me(Authentication a) {
        return auth.me(a.getName());
    }

    /** Tokens are stateless; the client discards its token. Kept as an endpoint for audit hooks. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }
}
