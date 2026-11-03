package com.rhr.intellicore.service;

import com.rhr.intellicore.domain.Alarm;
import com.rhr.intellicore.domain.Enums.AlarmSeverity;
import com.rhr.intellicore.domain.Enums.MachineStatus;
import com.rhr.intellicore.domain.Machine;
import com.rhr.intellicore.domain.MachineReading;
import com.rhr.intellicore.repo.AlarmRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;

/** Threshold rules evaluated on every reading. Repeats of the same alarm are suppressed for a cool-down. */
@Service
public class AlarmService {

    private static final Duration COOL_DOWN = Duration.ofMinutes(20);
    private static final double VIBRATION_LIMIT = 7.1; // ISO 10816 class II "unsatisfactory" boundary, mm/s

    private final AlarmRepository repo;
    private final ShiftService shiftService;
    private final Map<String, LocalDateTime> lastRaised = new ConcurrentHashMap<>();

    public AlarmService(AlarmRepository repo, ShiftService shiftService) {
        this.repo = repo;
        this.shiftService = shiftService;
    }

    public void evaluate(Machine m, MachineReading r, MachineStatus previousStatus) {
        if (r.getStatus() == MachineStatus.FAULT && previousStatus != MachineStatus.FAULT) {
            raise(m, r.getTs(), AlarmSeverity.CRITICAL, "FAULT", "Machine reported a fault and stopped", null);
        }
        if (r.getTemperature() > m.getMaxTemperature()) {
            boolean critical = r.getTemperature() > m.getMaxTemperature() + 5;
            raise(m, r.getTs(), critical ? AlarmSeverity.CRITICAL : AlarmSeverity.WARNING, "HIGH_TEMP",
                    String.format("Temperature %.1f °C above limit %.0f °C", r.getTemperature(), m.getMaxTemperature()),
                    r.getTemperature());
        }
        if (r.getStatus() == MachineStatus.RUNNING && r.getCvPercent() > m.getTargetCv() * 1.15) {
            raise(m, r.getTs(), AlarmSeverity.WARNING, "HIGH_CV",
                    String.format("CV%% %.2f exceeds target %.2f by more than 15%%", r.getCvPercent(), m.getTargetCv()),
                    r.getCvPercent());
        }
        if (r.getVibration() > VIBRATION_LIMIT) {
            raise(m, r.getTs(), AlarmSeverity.WARNING, "VIBRATION",
                    String.format("Vibration %.1f mm/s above %.1f mm/s", r.getVibration(), VIBRATION_LIMIT),
                    r.getVibration());
        }
    }

    public void raiseOffline(Machine m, LocalDateTime lastSeen) {
        raise(m, shiftService.now(), AlarmSeverity.WARNING, "OFFLINE",
                "No telemetry since " + lastSeen.withNano(0).toLocalTime(), null);
    }

    private void raise(Machine m, LocalDateTime ts, AlarmSeverity severity, String type, String message, Double value) {
        String key = m.getId() + ":" + type;
        LocalDateTime prev = lastRaised.get(key);
        if (prev != null && Duration.between(prev, ts).abs().compareTo(COOL_DOWN) < 0) return;
        lastRaised.put(key, ts);

        Alarm a = new Alarm();
        a.setMachineId(m.getId());
        a.setMachineCode(m.getCode());
        a.setTs(ts);
        a.setSeverity(severity);
        a.setType(type);
        a.setMessage(message);
        a.setValue(value == null ? null : Math.round(value * 100) / 100.0);
        repo.save(a);
    }

    public Page<Alarm> list(boolean activeOnly, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        return activeOnly ? repo.findByAcknowledgedFalseOrderByTsDesc(pr) : repo.findAllByOrderByTsDesc(pr);
    }

    public long activeCount() {
        return repo.countByAcknowledgedFalse();
    }

    public Alarm acknowledge(Long id, String user) {
        Alarm a = repo.findById(id).orElseThrow(() -> new NoSuchElementException("Alarm " + id + " not found"));
        if (!a.isAcknowledged()) {
            a.setAcknowledged(true);
            a.setAcknowledgedBy(user);
            a.setAcknowledgedAt(shiftService.now());
            repo.save(a);
        }
        return a;
    }

    public int acknowledgeAll(String user) {
        return repo.acknowledgeAll(user, shiftService.now());
    }
}
