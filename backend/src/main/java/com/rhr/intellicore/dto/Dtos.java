package com.rhr.intellicore.dto;

import com.rhr.intellicore.domain.AppUser;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Request / response payloads for the REST API. */
public final class Dtos {
    private Dtos() {}

    // ---- Auth / profile -------------------------------------------------

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    public record OtpRequest(@NotBlank @Pattern(regexp = "\\d{10}", message = "must be a 10 digit mobile number") String mobile) {}

    public record OtpVerifyRequest(@NotBlank String mobile, @NotBlank String otp) {}

    public record OtpChallenge(String mobile, String maskedMobile, int expiresInSeconds, String message) {}

    public record AuthResponse(String token, LocalDateTime expiresAt, UserView user) {}

    public record UserView(Long id, String username, String fullName, String mobile, String email, String role,
                           String designation, String department, String employeeId, String assignedShift,
                           LocalDateTime lastLoginAt) {
        public static UserView of(AppUser u) {
            return new UserView(u.getId(), u.getUsername(), u.getFullName(), u.getMobile(), u.getEmail(),
                    u.getRole().name(), u.getDesignation(), u.getDepartment(), u.getEmployeeId(),
                    u.getAssignedShift(), u.getLastLoginAt());
        }
    }

    public record ProfileUpdateRequest(@NotBlank String fullName, @Email String email,
                                       @Pattern(regexp = "\\d{10}", message = "must be a 10 digit mobile number") String mobile,
                                       String designation, String department, String assignedShift) {}

    public record PasswordChangeRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 6, max = 64) String newPassword) {}

    // ---- Shifts ---------------------------------------------------------

    public record ShiftWindow(String code, String name, String color, LocalDate shiftDate,
                              LocalDateTime start, LocalDateTime end) {}

    public record CurrentShift(ShiftWindow shift, ShiftWindow next, LocalDateTime serverTime,
                               long elapsedSeconds, long remainingSeconds, double progress) {}

    public record ShiftUpdateRequest(@NotBlank String name, @NotBlank String startTime, @NotBlank String endTime,
                                     String color, String inCharge) {}

    // ---- IoT ------------------------------------------------------------

    public record TelemetryRequest(@NotBlank String machineCode,
                                   LocalDateTime timestamp,
                                   String status,
                                   @PositiveOrZero Double speed,
                                   @PositiveOrZero Double cvPercent,
                                   Double temperature,
                                   @DecimalMin("0") @DecimalMax("100") Double humidity,
                                   @PositiveOrZero Double powerKw,
                                   @PositiveOrZero Double vibration,
                                   @PositiveOrZero Double productionKg,
                                   @PositiveOrZero Double rejectKg,
                                   @PositiveOrZero Integer breaks,
                                   String operatorName) {}

    public record IngestResult(String machineCode, LocalDateTime ts, String shiftCode, LocalDate shiftDate) {}

    public record LiveSnapshot(Long machineId, String code, String name, String type, String department, String line,
                               String status, boolean online, String source, LocalDateTime lastSeen,
                               double speed, double ratedSpeed, String speedUnit,
                               double cvPercent, double targetCv,
                               double temperature, double maxTemperature, double humidity,
                               double powerKw, double vibration,
                               String shiftCode, LocalDate shiftDate, String operatorName,
                               double shiftProductionKg, double shiftTargetKg, double shiftRejectKg, double energyKwh,
                               double availability, double performance, double quality, double oee,
                               int breaks, int stoppages, double runMinutes, double downMinutes) {}

    public record TrendPoint(LocalDateTime ts, String status, double speed, double cvPercent, double temperature,
                             double humidity, double powerKw, double vibration, double productionKg) {}

    public record MachineRequest(@NotBlank @Size(max = 20) String code, @NotBlank String name, @NotBlank String type,
                                 String department, String line, String make, String model, Integer spindles,
                                 @Positive double ratedSpeed, String speedUnit, @Positive double idealRateKgPerHour,
                                 @Positive double targetCv, @Positive double maxTemperature, LocalDate installedOn,
                                 Boolean enabled) {}

    // ---- Dashboard ------------------------------------------------------

    public record Kpi(double oee, double availability, double performance, double quality,
                      double productionKg, double targetKg, double rejectKg, double energyKwh,
                      double cvIndex, double runHours, double downHours, int breaks, int stoppages) {}

    public record ShiftBar(String shiftCode, String name, String color, double productionKg, double targetKg,
                           double oee, double availability, double performance, double quality) {}

    /** cvIndex is CV% as a percentage of each machine's target, so different machine types share one scale. */
    public record HourPoint(String hour, double productionKg, double cvIndex, double avgTemperature,
                            double avgHumidity, double loadKw) {}

    public record ScatterPoint(String machineCode, String machineType, String shiftCode,
                               double speedUtilisation, double cvIndex, double avgCv, double productionKg) {}

    public record MachineBar(String machineCode, String machineType, double productionKg, double targetKg, double oee) {}

    public record DayPoint(LocalDate date, double oee, double availability, double performance, double quality,
                           double productionKg) {}

    public record DashboardSummary(LocalDate date, String shift, Kpi kpi, Kpi previous,
                                   List<ShiftBar> shiftWise, List<HourPoint> hourly, List<ScatterPoint> scatter,
                                   List<MachineBar> machineWise, List<DayPoint> trend,
                                   Map<String, Long> statusCounts, long activeAlarms, int machineCount) {}

    // ---- Reports --------------------------------------------------------

    public record ReportRow(String period, String machineCode, String machineName, String machineType, String shiftCode,
                            double runHours, double downHours, double productionKg, double targetKg,
                            double achievement, double rejectKg, double avgSpeed, double avgCv,
                            double avgTemperature, double avgHumidity, double energyKwh, int breaks, int stoppages,
                            double availability, double performance, double quality, double oee) {}

    public record ReportPage(List<ReportRow> content, int page, int size, long totalElements, int totalPages,
                             ReportRow totals) {}
}
