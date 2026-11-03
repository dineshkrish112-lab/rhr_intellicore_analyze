package com.rhr.intellicore.service;

import com.rhr.intellicore.domain.AppUser;
import com.rhr.intellicore.domain.Machine;
import com.rhr.intellicore.domain.ShiftSummary;
import com.rhr.intellicore.dto.Dtos.*;
import com.rhr.intellicore.repo.AppUserRepository;
import com.rhr.intellicore.repo.ShiftSummaryRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private final ShiftSummaryRepository summaryRepo;
    private final ShiftService shiftService;
    private final TelemetryService telemetry;
    private final AlarmService alarmService;
    private final AppUserRepository userRepo;
    private final JdbcTemplate jdbc;

    public DashboardService(ShiftSummaryRepository summaryRepo, ShiftService shiftService, TelemetryService telemetry,
                            AlarmService alarmService, AppUserRepository userRepo, JdbcTemplate jdbc) {
        this.summaryRepo = summaryRepo;
        this.shiftService = shiftService;
        this.telemetry = telemetry;
        this.alarmService = alarmService;
        this.userRepo = userRepo;
        this.jdbc = jdbc;
    }

    public DashboardSummary summary(LocalDate date, String shift) {
        LocalDate day = date != null ? date : shiftService.currentProductionDate();
        String shiftCode = shift == null || shift.isBlank() || "ALL".equalsIgnoreCase(shift) ? null : shift.toUpperCase();
        Map<Long, Machine> machines = telemetry.machines().stream()
                .collect(Collectors.toMap(Machine::getId, Function.identity()));

        List<ShiftSummary> today = filter(summaryRepo.findByShiftDate(day), shiftCode);
        List<ShiftSummary> yesterday = filter(summaryRepo.findByShiftDate(day.minusDays(1)), shiftCode);

        List<ShiftBar> shiftWise = shiftService.definitions().stream().map(def -> {
            Kpi k = aggregate(today.stream().filter(s -> s.getShiftCode().equals(def.getCode())).toList(), machines);
            return new ShiftBar(def.getCode(), def.getName(), def.getColor(), k.productionKg(), k.targetKg(),
                    k.oee(), k.availability(), k.performance(), k.quality());
        }).toList();

        List<ScatterPoint> scatter = today.stream().filter(s -> s.getSamples() > 0 && machines.containsKey(s.getMachineId()))
                .map(s -> {
                    Machine m = machines.get(s.getMachineId());
                    return new ScatterPoint(m.getCode(), m.getType(), s.getShiftCode(),
                            r1(100 * s.getAvgSpeed() / m.getRatedSpeed()), r1(100 * s.getAvgCv() / m.getTargetCv()),
                            r2(s.getAvgCv()), r1(s.getProductionKg()));
                }).toList();

        Map<Long, List<ShiftSummary>> byMachine = today.stream().collect(Collectors.groupingBy(ShiftSummary::getMachineId));
        List<MachineBar> machineWise = machines.values().stream().sorted(Comparator.comparing(Machine::getCode)).map(m -> {
            Kpi k = aggregate(byMachine.getOrDefault(m.getId(), List.of()), machines);
            return new MachineBar(m.getCode(), m.getType(), k.productionKg(), k.targetKg(), k.oee());
        }).toList();

        Map<LocalDate, List<ShiftSummary>> byDay = filter(summaryRepo.findByShiftDateBetween(day.minusDays(13), day), shiftCode)
                .stream().collect(Collectors.groupingBy(ShiftSummary::getShiftDate, TreeMap::new, Collectors.toList()));
        List<DayPoint> trend = byDay.entrySet().stream().map(e -> {
            Kpi k = aggregate(e.getValue(), machines);
            return new DayPoint(e.getKey(), k.oee(), k.availability(), k.performance(), k.quality(), k.productionKg());
        }).toList();

        Map<String, Long> statusCounts = new LinkedHashMap<>();
        if (day.equals(shiftService.currentProductionDate())) {
            for (LiveSnapshot s : telemetry.snapshots()) statusCounts.merge(s.status(), 1L, Long::sum);
        }

        return new DashboardSummary(day, shiftCode == null ? "ALL" : shiftCode,
                aggregate(today, machines), aggregate(yesterday, machines), shiftWise, hourly(day, shiftCode),
                scatter, machineWise, trend, statusCounts, alarmService.activeCount(), machines.size());
    }

    /** Production-weighted OEE: factors are computed from summed times and quantities, not averaged percentages. */
    public static Kpi aggregate(Collection<ShiftSummary> list, Map<Long, Machine> machines) {
        double run = 0, down = 0, prod = 0, reject = 0, ideal = 0, target = 0, energy = 0, cvIdx = 0, samples = 0;
        int breaks = 0, stoppages = 0;
        for (ShiftSummary s : list) {
            Machine m = machines.get(s.getMachineId());
            if (m == null) continue;
            run += s.getRunSec();
            down += s.getDownSec();
            prod += s.getProductionKg();
            reject += s.getRejectKg();
            ideal += m.getIdealRateKgPerHour() * s.getRunSec() / 3600.0;
            target += s.getTargetKg();
            energy += s.getEnergyKwh();
            cvIdx += s.getCvSum() / m.getTargetCv() * 100;
            samples += s.getSamples();
            breaks += s.getBreaks();
            stoppages += s.getStoppages();
        }
        double a = run + down > 0 ? 100 * run / (run + down) : 0;
        double p = ideal > 0 ? Math.min(100, 100 * prod / ideal) : 0;
        double q = prod > 0 ? 100 * (prod - reject) / prod : 0;
        return new Kpi(r1(a * p * q / 10000), r1(a), r1(p), r1(q), r1(prod), r1(target), r1(reject), r1(energy),
                samples > 0 ? r1(cvIdx / samples) : 0, r1(run / 3600), r1(down / 3600), breaks, stoppages);
    }

    private List<HourPoint> hourly(LocalDate day, String shiftCode) {
        List<ShiftWindow> windows = shiftService.windowsFor(day).stream()
                .filter(w -> shiftCode == null || w.code().equals(shiftCode)).toList();
        if (windows.isEmpty()) return List.of();
        LocalDateTime from = windows.stream().map(ShiftWindow::start).min(Comparator.naturalOrder()).get();
        LocalDateTime to = windows.stream().map(ShiftWindow::end).max(Comparator.naturalOrder()).get();
        String sql = """
                select date_format(r.ts, '%%Y-%%m-%%d %%H:00') bucket,
                       sum(r.production_kg) prod,
                       avg(case when r.status = 'RUNNING' then r.cv_percent / m.target_cv * 100 end) cv_idx,
                       avg(r.temperature) temp,
                       avg(r.humidity) hum,
                       avg(r.power_kw) * count(distinct r.machine_id) load_kw
                from machine_reading r join machine m on m.id = r.machine_id
                where r.ts >= ? and r.ts < ? %s
                group by bucket order by bucket""".formatted(shiftCode == null ? "" : "and r.shift_code = ?");
        Object[] args = shiftCode == null
                ? new Object[]{Timestamp.valueOf(from), Timestamp.valueOf(to)}
                : new Object[]{Timestamp.valueOf(from), Timestamp.valueOf(to), shiftCode};
        return jdbc.query(sql, (rs, i) -> new HourPoint(rs.getString("bucket").substring(11),
                r1(rs.getDouble("prod")), r1(rs.getDouble("cv_idx")), r1(rs.getDouble("temp")),
                r1(rs.getDouble("hum")), r1(rs.getDouble("load_kw"))), args);
    }

    public String layout(String username) {
        return userRepo.findByUsernameIgnoreCase(username).map(AppUser::getDashboardLayout).orElse(null);
    }

    public void saveLayout(String username, String json) {
        AppUser u = userRepo.findByUsernameIgnoreCase(username).orElseThrow();
        u.setDashboardLayout(json);
        userRepo.save(u);
    }

    private static List<ShiftSummary> filter(List<ShiftSummary> list, String shiftCode) {
        return shiftCode == null ? list : list.stream().filter(s -> s.getShiftCode().equals(shiftCode)).toList();
    }

    static double r1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    static double r2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
