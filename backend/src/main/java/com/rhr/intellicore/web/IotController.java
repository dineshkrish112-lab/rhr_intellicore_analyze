package com.rhr.intellicore.web;

import com.rhr.intellicore.config.AppProperties;
import com.rhr.intellicore.domain.DeviceConnection;
import com.rhr.intellicore.repo.DeviceConnectionRepository;
import com.rhr.intellicore.service.device.ConnectorManager;
import com.rhr.intellicore.dto.Dtos.IngestResult;
import com.rhr.intellicore.dto.Dtos.LiveSnapshot;
import com.rhr.intellicore.dto.Dtos.TelemetryRequest;
import com.rhr.intellicore.service.SimulatorService;
import com.rhr.intellicore.service.TelemetryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Device-facing ingest API. PLC gateways / edge devices POST readings with the shared
 * {@code X-Device-Key}; the simulator steps aside for any machine a device reports for.
 */
@RestController
@RequestMapping("/api/iot")
public class IotController {

    private final TelemetryService telemetry;
    private final SimulatorService simulator;
    private final AppProperties props;
    private final DeviceConnectionRepository deviceRepo;
    private final ConnectorManager connectors;

    public IotController(TelemetryService telemetry, SimulatorService simulator, AppProperties props,
                         DeviceConnectionRepository deviceRepo, ConnectorManager connectors) {
        this.telemetry = telemetry;
        this.simulator = simulator;
        this.props = props;
        this.deviceRepo = deviceRepo;
        this.connectors = connectors;
    }

    @PostMapping("/telemetry")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public IngestResult ingest(@RequestHeader(value = "X-Device-Key", required = false) String key,
                               @Valid @RequestBody TelemetryRequest req) {
        checkKey(key);
        return telemetry.ingest(req, TelemetryService.SOURCE_DEVICE);
    }

    @PostMapping("/telemetry/batch")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, Object> batch(@RequestHeader(value = "X-Device-Key", required = false) String key,
                                     @RequestBody List<@Valid TelemetryRequest> readings) {
        checkKey(key);
        if (readings.size() > 500) throw new IllegalArgumentException("At most 500 readings per batch");
        List<String> errors = new ArrayList<>();
        int ok = 0;
        for (TelemetryRequest r : readings) {
            try {
                telemetry.ingest(r, TelemetryService.SOURCE_DEVICE);
                ok++;
            } catch (RuntimeException e) {
                errors.add(r.machineCode() + ": " + e.getMessage());
            }
        }
        return Map.of("accepted", ok, "rejected", errors.size(), "errors", errors);
    }

    /** Connection overview for the profile / settings screen. */
    @GetMapping("/status")
    public Map<String, Object> status() {
        List<LiveSnapshot> live = telemetry.snapshots();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("simulatorEnabled", simulator.isEnabled());
        m.put("ingestEndpoint", "/api/iot/telemetry");
        m.put("batchEndpoint", "/api/iot/telemetry/batch");
        m.put("authHeader", "X-Device-Key");
        m.put("offlineAfterSeconds", props.iot().offlineAfterSeconds());
        m.put("machinesOnline", live.stream().filter(LiveSnapshot::online).count());
        m.put("machinesTotal", live.size());
        m.put("deviceFed", live.stream().filter(s -> TelemetryService.SOURCE_DEVICE.equals(s.source())).count());
        m.put("devices", live.stream().map(s -> Map.of(
                "code", s.code(), "online", s.online(), "source", s.source() == null ? "-" : s.source(),
                "lastSeen", s.lastSeen() == null ? "" : s.lastSeen().toString())).toList());
        return m;
    }

    @PutMapping("/simulator")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Boolean> simulator(@RequestBody Map<String, Boolean> body) {
        simulator.setEnabled(Boolean.TRUE.equals(body.get("enabled")));
        return Map.of("enabled", simulator.isEnabled());
    }

    /** Accepts the shared plant key or a registered HTTP-push device's own key. */
    private void checkKey(String key) {
        byte[] expected = props.iot().deviceKey().getBytes(StandardCharsets.UTF_8);
        byte[] given = key == null ? new byte[0] : key.getBytes(StandardCharsets.UTF_8);
        if (MessageDigest.isEqual(expected, given)) return;
        DeviceConnection device = key == null || !key.startsWith("dev_") ? null
                : deviceRepo.findByApiKey(key).filter(DeviceConnection::isEnabled).orElse(null);
        if (device == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or missing X-Device-Key");
        }
        connectors.recordPush(device);
    }
}
