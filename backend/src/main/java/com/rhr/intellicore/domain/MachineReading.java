package com.rhr.intellicore.domain;

import com.rhr.intellicore.domain.Enums.MachineStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "machine_reading", indexes = {
        @Index(name = "idx_reading_machine_ts", columnList = "machineId,ts"),
        @Index(name = "idx_reading_ts", columnList = "ts")
})
@Getter
@Setter
public class MachineReading {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long machineId;

    @Column(nullable = false)
    private LocalDateTime ts;

    private LocalDate shiftDate;
    @Column(length = 4)
    private String shiftCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private MachineStatus status;

    private double speed;
    private double cvPercent;
    private double temperature;
    private double humidity;
    private double powerKw;
    private double vibration;
    /** Production since the previous reading (kg). */
    private double productionKg;
    /** End breaks since the previous reading. */
    private int breaks;

    @Column(length = 10)
    private String source;
}
