package com.rhr.intellicore.service;

import com.rhr.intellicore.config.AppProperties;
import com.rhr.intellicore.domain.Enums.MachineStatus;
import com.rhr.intellicore.domain.Machine;
import com.rhr.intellicore.dto.Dtos.TelemetryRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Stands in for PLC / IoT gateways during development. It feeds the same ingest path a real
 * device uses, and automatically steps aside for any machine that a real device is reporting for.
 */
@Service
public class SimulatorService {

    private static final Logger log = LoggerFactory.getLogger(SimulatorService.class);
    private static final String[][] OPERATORS = {
            {"Murugan K", "Lakshmi R", "Senthil P", "Kavitha S"},
            {"Ramesh V", "Divya M", "Prakash N", "Anitha G"},
            {"Selvam T", "Gowri B", "Karthik A", "Meena J"}};

    private final TelemetryService telemetry;
    private final ShiftService shiftService;
    private final AtomicBoolean enabled;
    private final long intervalMs;
    private final Map<Long, SimState> sims = new ConcurrentHashMap<>();
    private final Random rnd = new Random();

    /** Per-machine random-walk state so values drift smoothly instead of jumping. */
    public static final class SimState {
        MachineStatus status = MachineStatus.RUNNING;
        LocalDateTime statusUntil;
        double cvDrift;
        double tempDrift;
        double humidityDrift;
    }

    public SimulatorService(TelemetryService telemetry, ShiftService shiftService, AppProperties props) {
        this.telemetry = telemetry;
        this.shiftService = shiftService;
        this.enabled = new AtomicBoolean(props.simulator().enabled());
        this.intervalMs = props.simulator().intervalMs();
    }

    public boolean isEnabled() {
        return enabled.get();
    }

    public void setEnabled(boolean on) {
        enabled.set(on);
        log.info("Telemetry simulator {}", on ? "enabled" : "disabled");
    }

    @Scheduled(fixedRateString = "${app.simulator.interval-ms}", initialDelay = 3000)
    public void tick() {
        if (!enabled.get()) return;
        LocalDateTime now = shiftService.now();
        for (Machine m : telemetry.machines()) {
            if (!m.isEnabled() || telemetry.receivedDeviceDataRecently(m.getId(), 60)) continue;
            SimState s = sims.computeIfAbsent(m.getId(), id -> new SimState());
            try {
                telemetry.ingest(next(m, s, intervalMs / 1000.0, now, rnd), TelemetryService.SOURCE_SIMULATOR);
            } catch (RuntimeException e) {
                log.warn("Simulator ingest failed for {}: {}", m.getCode(), e.getMessage());
            }
        }
    }

    /** Generates the next reading for a machine; also used by the seeder to back-fill trend data. */
    public TelemetryRequest next(Machine m, SimState s, double dtSec, LocalDateTime ts, Random rnd) {
        stepStatus(s, ts, rnd);
        boolean running = s.status == MachineStatus.RUNNING;
        double baseEff = 0.90 + (m.getId() % 5) * 0.015;

        s.cvDrift = bound(s.cvDrift + rnd.nextGaussian() * 0.01, -0.08, 0.14);
        s.tempDrift = bound(s.tempDrift + rnd.nextGaussian() * 0.08, -2, 4);
        s.humidityDrift = bound(s.humidityDrift + rnd.nextGaussian() * 0.1, -4, 4);

        double speed = running ? m.getRatedSpeed() * bound(baseEff + rnd.nextGaussian() * 0.012, 0.75, 1.0) : 0;
        double cv = m.getTargetCv() * (0.96 + s.cvDrift + rnd.nextGaussian() * 0.02);
        double temp = m.getMaxTemperature() - 9 + (running ? 2.5 : -1.5) + s.tempDrift + rnd.nextGaussian() * 0.25;
        double humidity = 56 + s.humidityDrift + rnd.nextGaussian() * 0.4;
        double power = ratedPowerKw(m.getType()) * (running ? 0.82 + rnd.nextDouble() * 0.12 : 0.06);
        double vibration = running ? 2.2 + rnd.nextDouble() * 1.6 + (rnd.nextDouble() < 0.002 ? 4 : 0) : 0.3;
        double production = running ? m.getIdealRateKgPerHour() * dtSec / 3600.0 * (speed / m.getRatedSpeed())
                * (0.97 + rnd.nextDouble() * 0.03) : 0;
        double reject = production * (0.006 + Math.max(0, cv / m.getTargetCv() - 1) * 0.08);
        int breaks = running ? poisson(breakRatePerHour(m.getType()) * dtSec / 3600.0, rnd) : 0;

        String operator = operatorFor(shiftService.resolve(ts).code(), m.getId());

        return new TelemetryRequest(m.getCode(), ts, s.status.name(), r2(speed), r2(Math.max(0.5, cv)), r2(temp),
                r2(bound(humidity, 35, 85)), r2(power), r2(vibration), production, reject, breaks, operator);
    }

    private void stepStatus(SimState s, LocalDateTime ts, Random rnd) {
        if (s.status != MachineStatus.RUNNING) {
            if (s.statusUntil == null || !ts.isBefore(s.statusUntil)) {
                s.status = MachineStatus.RUNNING;
                s.statusUntil = ts.plusMinutes(2);
            }
            return;
        }
        if (s.statusUntil != null && ts.isBefore(s.statusUntil)) return;
        double p = rnd.nextDouble();
        // Probabilities per 5 s tick: doffing / idle ~ every 45 min, stoppage ~ 1.5 h, fault ~ 10 h.
        if (p < 0.0018) {
            s.status = MachineStatus.IDLE;
            s.statusUntil = ts.plusSeconds(60 + rnd.nextInt(180));
        } else if (p < 0.0027) {
            s.status = MachineStatus.STOPPED;
            s.statusUntil = ts.plusSeconds(120 + rnd.nextInt(360));
        } else if (p < 0.00284) {
            s.status = MachineStatus.FAULT;
            s.statusUntil = ts.plusSeconds(240 + rnd.nextInt(600));
        }
    }

    public static String operatorFor(String shiftCode, long machineId) {
        return OPERATORS[Math.max(0, "ABC".indexOf(shiftCode))][(int) (machineId % 4)];
    }

    public static double ratedPowerKw(String type) {
        return switch (type) {
            case "Carding" -> 15;
            case "Draw Frame" -> 9;
            case "Simplex" -> 18;
            case "Ring Frame" -> 32;
            case "Autoconer" -> 26;
            default -> 20;
        };
    }

    public static double breakRatePerHour(String type) {
        return switch (type) {
            case "Ring Frame" -> 40;
            case "Simplex" -> 6;
            case "Autoconer" -> 18;
            default -> 2;
        };
    }

    private static int poisson(double lambda, Random rnd) {
        double l = Math.exp(-lambda), p = 1;
        int k = 0;
        do {
            k++;
            p *= rnd.nextDouble();
        } while (p > l);
        return k - 1;
    }

    private static double bound(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static double r2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
