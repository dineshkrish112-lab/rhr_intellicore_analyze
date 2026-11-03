package com.rhr.intellicore.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.rhr.intellicore.domain.Enums.Role;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_user")
@Getter
@Setter
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String username;

    @JsonIgnore
    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 120)
    private String fullName;

    @Column(unique = true, length = 15)
    private String mobile;

    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    private String designation;
    private String department;
    private String employeeId;
    private String assignedShift;

    @JsonIgnore
    @Column(columnDefinition = "TEXT")
    private String dashboardLayout;

    private boolean enabled = true;
    private LocalDateTime lastLoginAt;
}
