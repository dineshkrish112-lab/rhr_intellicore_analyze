package com.rhr.intellicore.domain;

import com.rhr.intellicore.domain.Enums.AlarmSeverity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "alarm", indexes = @Index(name = "idx_alarm_ts", columnList = "ts"))
@Getter
@Setter
public class Alarm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long machineId;
    private String machineCode;
    private LocalDateTime ts;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private AlarmSeverity severity;

    /** HIGH_TEMP, HIGH_CV, FAULT, OFFLINE ... */
    @Column(length = 20)
    private String type;
    private String message;
    private Double value;

    private boolean acknowledged;
    private String acknowledgedBy;
    private LocalDateTime acknowledgedAt;
}
