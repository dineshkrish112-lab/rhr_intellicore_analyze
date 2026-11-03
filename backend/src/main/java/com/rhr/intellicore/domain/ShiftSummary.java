package com.rhr.intellicore.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Running aggregate of one machine's performance for one shift; updated on every reading. */
@Entity
@Table(name = "shift_summary",
        uniqueConstraints = @UniqueConstraint(name = "uk_summary", columnNames = {"machineId", "shiftDate", "shiftCode"}),
        indexes = @Index(name = "idx_summary_date", columnList = "shiftDate"))
@Getter
@Setter
public class ShiftSummary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long machineId;
    @Column(nullable = false)
    private LocalDate shiftDate;
    @Column(nullable = false, length = 4)
    private String shiftCode;

    private long plannedSec;
    private long runSec;
    private long downSec;
    private int stoppages;
    private int breaks;

    private double productionKg;
    private double rejectKg;
    private double targetKg;
    private double energyKwh;

    private long samples;
    private double speedSum;
    private double cvSum;
    private double tempSum;
    private double humiditySum;

    private double avgSpeed;
    private double avgCv;
    private double avgTemperature;
    private double avgHumidity;

    private double availability;
    private double performance;
    private double quality;
    private double oee;

    private String operatorName;
    private LocalDateTime updatedAt;

    /** Recomputes averages and OEE factors (all percentages 0-100). */
    public void recompute(double idealRateKgPerHour) {
        if (samples > 0) {
            avgSpeed = speedSum / samples;
            avgCv = cvSum / samples;
            avgTemperature = tempSum / samples;
            avgHumidity = humiditySum / samples;
        }
        long elapsed = runSec + downSec;
        availability = elapsed > 0 ? clamp(100.0 * runSec / elapsed) : 0;
        double ideal = idealRateKgPerHour * runSec / 3600.0;
        performance = ideal > 0 ? clamp(100.0 * productionKg / ideal) : 0;
        quality = productionKg > 0 ? clamp(100.0 * (productionKg - rejectKg) / productionKg) : 0;
        oee = availability * performance * quality / 10000.0;
        targetKg = idealRateKgPerHour * plannedSec / 3600.0 * 0.85;
    }

    private static double clamp(double v) {
        return Math.max(0, Math.min(100, v));
    }
}
