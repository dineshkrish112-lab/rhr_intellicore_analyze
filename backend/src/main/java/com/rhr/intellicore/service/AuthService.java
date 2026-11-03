package com.rhr.intellicore.service;

import com.rhr.intellicore.config.AppProperties;
import com.rhr.intellicore.config.JwtService;
import com.rhr.intellicore.domain.AppUser;
import com.rhr.intellicore.dto.Dtos.*;
import com.rhr.intellicore.repo.AppUserRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.NoSuchElementException;

/**
 * Static-credential login. Users are provisioned by the seeder / admin; there is no self sign-up.
 * Mobile login uses a fixed OTP from configuration until an SMS gateway is integrated.
 */
@Service
public class AuthService {

    private final AppUserRepository userRepo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final ShiftService shiftService;
    private final String staticOtp;

    public AuthService(AppUserRepository userRepo, PasswordEncoder encoder, JwtService jwt,
                       ShiftService shiftService, AppProperties props) {
        this.userRepo = userRepo;
        this.encoder = encoder;
        this.jwt = jwt;
        this.shiftService = shiftService;
        this.staticOtp = props.auth().staticOtp();
    }

    public AuthResponse login(LoginRequest req) {
        AppUser u = userRepo.findByUsernameIgnoreCase(req.username().trim())
                .filter(AppUser::isEnabled)
                .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));
        return issue(u);
    }

    public OtpChallenge requestOtp(OtpRequest req) {
        userRepo.findByMobile(req.mobile()).filter(AppUser::isEnabled)
                .orElseThrow(() -> new BadCredentialsException("Mobile number is not registered"));
        String m = req.mobile();
        return new OtpChallenge(m, "XXXXXX" + m.substring(m.length() - 4), 300,
                "OTP sent to registered mobile number");
    }

    public AuthResponse verifyOtp(OtpVerifyRequest req) {
        AppUser u = userRepo.findByMobile(req.mobile().trim()).filter(AppUser::isEnabled)
                .orElseThrow(() -> new BadCredentialsException("Mobile number is not registered"));
        if (!staticOtp.equals(req.otp().trim())) throw new BadCredentialsException("Invalid OTP");
        return issue(u);
    }

    public UserView me(String username) {
        return UserView.of(user(username));
    }

    public UserView updateProfile(String username, ProfileUpdateRequest req) {
        AppUser u = user(username);
        if (req.mobile() != null && !req.mobile().equals(u.getMobile())) {
            userRepo.findByMobile(req.mobile()).ifPresent(o -> {
                throw new IllegalArgumentException("Mobile number already belongs to another user");
            });
            u.setMobile(req.mobile());
        }
        u.setFullName(req.fullName());
        u.setEmail(req.email());
        u.setDesignation(req.designation());
        u.setDepartment(req.department());
        u.setAssignedShift(req.assignedShift());
        return UserView.of(userRepo.save(u));
    }

    public void changePassword(String username, PasswordChangeRequest req) {
        AppUser u = user(username);
        if (!encoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(req.newPassword()));
        userRepo.save(u);
    }

    private AuthResponse issue(AppUser u) {
        u.setLastLoginAt(shiftService.now());
        userRepo.save(u);
        JwtService.Issued t = jwt.issue(u);
        return new AuthResponse(t.token(), t.expiresAt(), UserView.of(u));
    }

    private AppUser user(String username) {
        return userRepo.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
    }
}
