package com.rhr.intellicore.web;

import com.rhr.intellicore.domain.PlantProfile;
import com.rhr.intellicore.dto.Dtos.PasswordChangeRequest;
import com.rhr.intellicore.dto.Dtos.ProfileUpdateRequest;
import com.rhr.intellicore.dto.Dtos.UserView;
import com.rhr.intellicore.repo.PlantProfileRepository;
import com.rhr.intellicore.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final AuthService auth;
    private final PlantProfileRepository plantRepo;

    public ProfileController(AuthService auth, PlantProfileRepository plantRepo) {
        this.auth = auth;
        this.plantRepo = plantRepo;
    }

    @GetMapping
    public Map<String, Object> profile(Authentication a) {
        return Map.of("user", auth.me(a.getName()), "plant", plant());
    }

    @PutMapping("/me")
    public UserView update(Authentication a, @Valid @RequestBody ProfileUpdateRequest req) {
        return auth.updateProfile(a.getName(), req);
    }

    @PutMapping("/password")
    public ResponseEntity<Void> password(Authentication a, @Valid @RequestBody PasswordChangeRequest req) {
        auth.changePassword(a.getName(), req);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/plant")
    public PlantProfile plant() {
        return plantRepo.findFirstByOrderByIdAsc().orElseGet(PlantProfile::new);
    }

    @PutMapping("/plant")
    @PreAuthorize("hasRole('ADMIN')")
    public PlantProfile updatePlant(@RequestBody PlantProfile body) {
        PlantProfile p = plantRepo.findFirstByOrderByIdAsc().orElseGet(PlantProfile::new);
        body.setId(p.getId());
        return plantRepo.save(body);
    }
}
