package com.rhr.intellicore.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "machine")
@Getter
@Setter
public class Machine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false)
    private String name;

    /** Ring Frame, Carding, Draw Frame, Simplex, Autoconer, ... */
    @Column(nullable = false)
    private String type;

    private String department;
    private String line;
    private String make;
    private String model;
    private Integer spindles;

    private double ratedSpeed;
    private String speedUnit;
    /** Ideal output used for the OEE performance factor. */
    private double idealRateKgPerHour;
    private double targetCv;
    private double maxTemperature;
    private LocalDate installedOn;

    private boolean enabled = true;
}
