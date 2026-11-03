package com.rhr.intellicore.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** A user-built dashboard tab. Widgets (chart type, query, size) are stored as a JSON array. */
@Entity
@Table(name = "custom_dashboard")
@Getter
@Setter
public class CustomDashboard {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String owner;

    @Column(nullable = false, length = 80)
    private String name;

    private String description;

    /** Shared dashboards are visible (read-only) to every user. */
    private boolean shared;

    private int position;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String widgets;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
