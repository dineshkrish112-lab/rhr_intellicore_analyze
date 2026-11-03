package com.rhr.intellicore.service;

import com.rhr.intellicore.config.AppProperties;
import com.rhr.intellicore.domain.Enums.MachineStatus;
import com.rhr.intellicore.domain.Machine;
import com.rhr.intellicore.domain.MachineReading;
import com.rhr.intellicore.domain.ShiftSummary;
import com.rhr.intellicore.dto.Dtos.*;
import com.rhr.intellicore.repo.MachineReadingRepository;
import com.rhr.intellicore.repo.MachineRepository;
import com.rhr.intellicore.repo.ShiftSummaryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Single entry point for machine telemetry, whether it comes from a real device / gateway
 * or from the built-in simulator. Persists the raw reading, rolls it into the machine's
 * shift summary and keeps an in-memory live view for the dashboard.
 */
@Service
public class TelemetryService {

    private static final Logger log = LoggerFactory.getLogger(TelemetryService.class);
    private static final long MAX_GAP_SECONDS = 60;

    public static final String SOURCE_DEVICE = "DEVICE";
    public static final String SOURCE_SIMULATOR = "SIMULATOR";

    private final MachineRepository machineRepo;
    private final MachineReadingRepository readingRepo;
    private final ShiftSummaryRepository summaryRepo;
    private final ShiftService shiftService;
    private final AlarmService alarmService;
    private final AppProperties props;

    private final Map<Long, LiveState> states = new ConcurrentHashMap<>();
    private volatile Map<String, Machine> machinesByCode = Map.of();

    static final class LiveState {
        Machine machine;
        MachineReading last;
        ShiftSummary summary;
        LocalDateTime lastSeen;
        LocalDateTime lastDeviceAt;
        String source;
        boolean offlineAlarmRaised;
    }

    public TelemetryService(MachineRepository machineRepo, MachineReadingRepository readingRepo,
                            ShiftSummaryRepository summaryRepo, ShiftService shiftService,
                            AlarmService alarmService, AppProperties props) {
        this.machineRepo = machineRepo;
        this.readingRepo = readingRepo;
        this.summaryRepo = summaryRepo;
        this.shiftService = shiftService;
        this.alarmService = alarmService;
        this.props = props;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void init() {
        refreshMachines();
        ShiftWindow current = shiftService.resolve(shiftService.now());
        for (Machine m : machinesByCode.values()) {
            LiveState st = state(m);
            readingRepo.findTopByMachineIdOrderByTsDesc(m.getId()).ifPresent(r -> {
                st.last = r;
                st.lastSeen = r.getTs();
                st.source = r.getSource();
            });
            summaryRepo.findByMachineIdAndShiftDateAndShiftCode(m.getId(), current.shiftDate(), current.code())
                    .ifPresent(s -> st.summary = s);
        }
        log.info("Live state initialised for {} machines", machinesByCode.size());
    }

    /** Re-reads the machine master; call after machines are added or edited. */
    public void refreshMachines() {
        Map<String, Machine> map = new HashMap<>();
        for (Machine m : machineRepo.findAll()) {
            map.put(m.getCode().toUpperCase(), m);
            states.computeIfAbsent(m.getId(), id -> new LiveState()).machine = m;
        }
        states.keySet().removeIf(id -> map.values().stream().noneMatch(m -> m.getId().equals(id)));
        machinesByCode = map;
    }

    public Collection<Machine> machines() {
        return machinesByCode.values().stream().sorted(Comparator.comparing(Machine::getCode)).toList();
    }

    public boolean receivedDeviceDataRecently(Long machineId, int seconds) {
        LiveState st = states.get(machineId);
        return st != null && st.lastDeviceAt != null
                && Duration.between(st.lastDeviceAt, shiftService.now()).toSeconds() < seconds;
    }

    public IngestResult ingest(TelemetryRequest req, String source) {
        Machine m = machinesByCode.get(req.machineCode().trim().toUpperCase());
        if (m == null) throw new NoSuchElementException("Unknown machine code " + req.machineCode());
        if (!m.isEnabled()) throw new IllegalStateException("Machine " + m.getCode() + " is disabled");

        LocalDateTime now = shiftService.now();
        LocalDateTime ts = req.timestamp() != null ? req.timestamp() : now;
        ShiftWindow w = shiftService.resolve(ts);
        LiveState st = state(m);
        MachineReading reading;
        MachineStatus previousStatus;

        synchronized (st) {
            MachineReading prev = st.last;
            previousStatus = prev != null ? prev.getStatus() : MachineStatus.RUNNING;
            long dt = st.lastSeen == null ? props.simulator().intervalMs() / 1000
                    : Math.max(0, Math.min(MAX_GAP_SECONDS, Duration.between(st.lastSeen, ts).toSeconds()));

            reading = new MachineReading();
            reading.setMachineId(m.getId());
            reading.setTs(ts);
            reading.setShiftDate(w.shiftDate());
            reading.setShiftCode(w.code());
            reading.setStatus(parseStatus(req.status()));
            reading.setSpeed(or(req.speed(), prev == null ? 0 : prev.getSpeed()));
            reading.setCvPercent(or(req.cvPercent(), prev == null ? m.getTargetCv() : prev.getCvPercent()));
            reading.setTemperature(or(req.temperature(), prev == null ? 0 : prev.getTemperature()));
            reading.setHumidity(or(req.humidity(), prev == null ? 0 : prev.getHumidity()));
            reading.setPowerKw(or(req.powerKw(), prev == null ? 0 : prev.getPowerKw()));
            reading.setVibration(or(req.vibration(), prev == null ? 0 : prev.getVibration()));
            reading.setProductionKg(or(req.productionKg(), 0));
            reading.setBreaks(req.breaks() == null ? 0 : req.breaks());
            reading.setSource(source);
            readingRepo.save(reading);

            ShiftSummary s = st.summary;
            if (s == null || !s.getShiftDate().equals(w.shiftDate()) || !s.getShiftCode().equals(w.code())) {
                s = summaryRepo.findByMachineIdAndShiftDateAndShiftCode(m.getId(), w.shiftDate(), w.code())
                        .orElseGet(() -> newSummary(m, w));
            }
            boolean running = reading.getStatus() == MachineStatus.RUNNING;
            if (running) s.setRunSec(s.getRunSec() + dt);
            else s.setDownSec(s.getDownSec() + dt);
            if (previousStatus == MachineStatus.RUNNING && !running) s.setStoppages(s.getStoppages() + 1);
            s.setBreaks(s.getBreaks() + reading.getBreaks());
            s.setProductionKg(s.getProductionKg() + reading.getProductionKg());
            s.setRejectKg(s.getRejectKg() + or(req.rejectKg(), 0));
            s.setEnergyKwh(s.getEnergyKwh() + reading.getPowerKw() * dt / 3600.0);
            if (running) {
                s.setSamples(s.getSamples() + 1);
                s.setSpeedSum(s.getSpeedSum() + reading.getSpeed());
                s.setCvSum(s.getCvSum() + reading.getCvPercent());
                s.setTempSum(s.getTempSum() + reading.getTemperature());
                s.setHumiditySum(s.getHumiditySum() + reading.getHumidity());
            }
            if (req.operatorName() != null && !req.operatorName().isBlank()) s.setOperatorName(req.operatorName());
            s.setUpdatedAt(now);
            s.recompute(m.getIdealRateKgPerHour());
            st.summary = summaryRepo.save(s);

            st.last = reading;
            if (st.lastSeen == null || ts.isAfter(st.lastSeen)) st.lastSeen = ts;
            st.source = source;
            st.offlineAlarmRaised = false;
            if (SOURCE_DEVICE.equals(source)) st.lastDeviceAt = now;
        }

        alarmService.evaluate(m, reading, previousStatus);
        return new IngestResult(m.getCode(), ts, w.code(), w.shiftDate());
    }

    public List<LiveSnapshot> snapshots() {
        ShiftWindow current = shiftService.resolve(shiftService.now());
        return machines().stream().map(m -> snapshot(state(m), current)).toList();
    }

    public LiveSnapshot snapshot(Long machineId) {
        LiveState st = states.get(machineId);
        if (st == null) throw new NoSuchElementException("Unknown machine " + machineId);
        return snapshot(st, shiftService.resolve(shiftService.now()));
    }

    public List<TrendPoint> trend(Long machineId, int minutes) {
        LocalDateTime after = shiftService.now().minusMinutes(Math.max(5, Math.min(minutes, 24 * 60)));
        List<MachineReading> rows = readingRepo.findByMachineIdAndTsAfterOrderByTsAsc(machineId, after);
        int step = Math.max(1, rows.size() / 600);
        List<TrendPoint> out = new ArrayList<>();
        for (int i = 0; i < rows.size(); i += step) {
            MachineReading r = rows.get(i);
            out.add(new TrendPoint(r.getTs(), r.getStatus().name(), r.getSpeed(), r.getCvPercent(),
                    r.getTemperature(), r.getHumidity(), r.getPowerKw(), r.getVibration(), r.getProductionKg()));
        }
        return out;
    }

    /** Raises an OFFLINE alarm once for machines whose device has gone silent. */
    @Scheduled(fixedDelay = 15000, initialDelay = 30000)
    public void detectOffline() {
        LocalDateTime now = shiftService.now();
        for (LiveState st : states.values()) {
            if (st.machine == null || !st.machine.isEnabled() || st.lastSeen == null || st.offlineAlarmRaised) continue;
            if (Duration.between(st.lastSeen, now).toSeconds() > props.iot().offlineAfterSeconds()) {
                st.offlineAlarmRaised = true;
                alarmService.raiseOffline(st.machine, st.lastSeen);
            }
        }
    }

    @Scheduled(cron = "0 15 * * * *")
    public void purgeOldReadings() {
        int n = readingRepo.deleteOlderThan(shiftService.now().minusDays(props.iot().readingRetentionDays()));
        if (n > 0) log.info("Purged {} telemetry rows older than {} days", n, props.iot().readingRetentionDays());
    }

    // ---------------------------------------------------------------------

    private LiveSnapshot snapshot(LiveState st, ShiftWindow current) {
        Machine m = st.machine;
        MachineReading r = st.last;
        boolean online = st.lastSeen != null
                && Duration.between(st.lastSeen, shiftService.now()).toSeconds() <= props.iot().offlineAfterSeconds();
        ShiftSummary s = st.summary != null && st.summary.getShiftDate().equals(current.shiftDate())
                && st.summary.getShiftCode().equals(current.code()) ? st.summary : null;
        String status = !online ? MachineStatus.OFFLINE.name() : r.getStatus().name();
        return new LiveSnapshot(m.getId(), m.getCode(), m.getName(), m.getType(), m.getDepartment(), m.getLine(),
                status, online, st.source, st.lastSeen,
                r == null ? 0 : r.getSpeed(), m.getRatedSpeed(), m.getSpeedUnit(),
                r == null ? 0 : r.getCvPercent(), m.getTargetCv(),
                r == null ? 0 : r.getTemperature(), m.getMaxTemperature(), r == null ? 0 : r.getHumidity(),
                r == null ? 0 : r.getPowerKw(), r == null ? 0 : r.getVibration(),
                current.code(), current.shiftDate(), s == null ? null : s.getOperatorName(),
                s == null ? 0 : s.getProductionKg(), s == null ? 0 : s.getTargetKg(),
                s == null ? 0 : s.getRejectKg(), s == null ? 0 : s.getEnergyKwh(),
                s == null ? 0 : s.getAvailability(), s == null ? 0 : s.getPerformance(),
                s == null ? 0 : s.getQuality(), s == null ? 0 : s.getOee(),
                s == null ? 0 : s.getBreaks(), s == null ? 0 : s.getStoppages(),
                s == null ? 0 : s.getRunSec() / 60.0, s == null ? 0 : s.getDownSec() / 60.0);
    }

    private LiveState state(Machine m) {
        LiveState st = states.computeIfAbsent(m.getId(), id -> new LiveState());
        st.machine = m;
        return st;
    }

    private ShiftSummary newSummary(Machine m, ShiftWindow w) {
        ShiftSummary s = new ShiftSummary();
        s.setMachineId(m.getId());
        s.setShiftDate(w.shiftDate());
        s.setShiftCode(w.code());
        s.setPlannedSec(Duration.between(w.start(), w.end()).toSeconds());
        return s;
    }

    private static MachineStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return MachineStatus.RUNNING;
        try {
            return MachineStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("status must be one of RUNNING, IDLE, STOPPED, FAULT");
        }
    }

    private static double or(Double v, double fallback) {
        return v == null ? fallback : v;
    }
}
