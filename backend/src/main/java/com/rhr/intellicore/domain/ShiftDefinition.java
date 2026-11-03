package com.rhr.intellicore.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalTime;

@Entity
@Table(name = "shift_definition")
@Getter
@Setter
public class ShiftDefinition {
    @Id
    @Column(length = 4)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    private String color;
    private String inCharge;
}
