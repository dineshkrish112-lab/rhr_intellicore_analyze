package com.rhr.intellicore.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rhr.intellicore.domain.DeviceConnection;
import com.rhr.intellicore.domain.Enums.DeviceProtocol;
import com.rhr.intellicore.domain.Machine;
import com.rhr.intellicore.repo.DeviceConnectionRepository;
import com.rhr.intellicore.repo.MachineRepository;
import com.rhr.intellicore.service.ShiftService;
import com.rhr.intellicore.service.device.ConnectorManager;
import com.rhr.intellicore.service.device.ConnectorManager.TestResult;
import com.rhr.intellicore.service.device.RegisterMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

/** Field devices (PLC, HMI, gateways) and their live connector state. */
@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceConnectionRepository repo;
    private final MachineRepository machineRepo;
    private final ConnectorManager connectors;
    private final ShiftService shiftService;
    private final ObjectMapper mapper;
    private final SecureRandom random = new SecureRandom();

    public DeviceController(DeviceConnectionRepository repo, MachineRepository machineRepo, ConnectorManager connectors,
                            ShiftService shiftService, ObjectMapper mapper) {
        this.repo = repo;
        this.machineRepo = machineRepo;
        this.connectors = connectors;
        this.shiftService = shiftService;
        this.mapper = mapper;
    }

    public record DeviceView(DeviceConnection device, Map<String, Object> runtime, String machineCode,
                             boolean hasPassword) {}

    /** Protocol catalogue for the form: default ports and what each protocol does here. */
    @GetMapping("/protocols")
    public List<Map<String, Object>> protocols() {
        return List.of(
                Map.of("key", "MQTT", "label", "MQTT", "defaultPort", 1883, "tlsPort", 8883,
                        "description", "Subscribe to a broker topic. Payload: JSON reading (or array) with machineCode."),
                Map.of("key", "MODBUS_TCP", "label", "Modbus TCP", "defaultPort", 502,
                        "description", "Poll PLC / HMI holding registers on an interval using a register map."),
                Map.of("key", "OPC_UA", "label", "OPC UA", "defaultPort", 4840,
                        "description", "Endpoint is monitored for reachability; values arrive via an edge gateway."),
                Map.of("key", "HTTP_PUSH", "label", "HTTP push", "defaultPort", 443,
                        "description", "Device POSTs JSON to /api/iot/telemetry using its own device key."));
    }

    @GetMapping
    public List<DeviceView> list(Authentication auth) {
        Map<Long, String> codes = machineRepo.findAll().stream().collect(Collectors.toMap(Machine::getId, Machine::getCode));
        boolean admin = isAdmin(auth);
        return repo.findAllByOrderByNameAsc().stream().map(d -> view(d, codes, admin)).toList();
    }

    @GetMapping("/{id}")
    public DeviceView get(@PathVariable Long id, Authentication auth) {
        Map<Long, String> codes = machineRepo.findAll().stream().collect(Collectors.toMap(Machine::getId, Machine::getCode));
        return view(find(id), codes, isAdmin(auth));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceView create(@RequestBody DeviceConnection body, Authentication auth) {
        body.setId(null);
        validate(body);
        if (body.getProtocol() == DeviceProtocol.HTTP_PUSH) body.setApiKey(newKey());
        body.setCreatedAt(shiftService.now());
        body.setUpdatedAt(body.getCreatedAt());
        DeviceConnection saved = repo.save(body);
        connectors.apply(saved);
        return get(saved.getId(), auth);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceView update(@PathVariable Long id, @RequestBody DeviceConnection body, Authentication auth) {
        DeviceConnection existing = find(id);
        body.setId(id);
        validate(body);
        if (body.getPassword() == null || body.getPassword().isEmpty()) body.setPassword(existing.getPassword());
        body.setApiKey(body.getProtocol() == DeviceProtocol.HTTP_PUSH
                ? (existing.getApiKey() != null ? existing.getApiKey() : newKey()) : null);
        body.setCreatedAt(existing.getCreatedAt());
        body.setUpdatedAt(shiftService.now());
        DeviceConnection saved = repo.save(body);
        connectors.apply(saved);
        return get(id, auth);
    }

    @PostMapping("/{id}/enabled")
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceView setEnabled(@PathVariable Long id, @RequestBody Map<String, Boolean> body, Authentication auth) {
        DeviceConnection d = find(id);
        d.setEnabled(Boolean.TRUE.equals(body.get("enabled")));
        d.setUpdatedAt(shiftService.now());
        connectors.apply(repo.save(d));
        return get(id, auth);
    }

    @PostMapping("/{id}/regenerate-key")
    @PreAuthorize("hasRole('ADMIN')")
    public DeviceView regenerateKey(@PathVariable Long id, Authentication auth) {
        DeviceConnection d = find(id);
        if (d.getProtocol() != DeviceProtocol.HTTP_PUSH) throw new IllegalArgumentException("Only HTTP push devices use a key");
        d.setApiKey(newKey());
        repo.save(d);
        return get(id, auth);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        find(id);
        connectors.stop(id);
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Tests a saved device. */
    @PostMapping("/{id}/test")
    @PreAuthorize("hasRole('ADMIN')")
    public TestResult test(@PathVariable Long id) {
        return connectors.test(find(id));
    }

    /** Tests settings from the form before they are saved. */
    @PostMapping("/test")
    @PreAuthorize("hasRole('ADMIN')")
    public TestResult testUnsaved(@RequestBody DeviceConnection body) {
        if (body.getId() != null && (body.getPassword() == null || body.getPassword().isEmpty())) {
            repo.findById(body.getId()).ifPresent(e -> body.setPassword(e.getPassword()));
        }
        validate(body);
        return connectors.test(body);
    }

    // ---------------------------------------------------------------------

    private DeviceView view(DeviceConnection d, Map<Long, String> codes, boolean admin) {
        boolean hasPassword = d.getPassword() != null && !d.getPassword().isEmpty();
        String key = d.getApiKey();
        if (!admin && key != null) {
            // Detach a copy so the masked key is never written back.
            DeviceConnection copy = mapper.convertValue(mapper.valueToTree(d), DeviceConnection.class);
            copy.setApiKey("••••" + key.substring(key.length() - 4));
            d = copy;
        }
        return new DeviceView(d, connectors.runtime(d.getId()).view(),
                d.getMachineId() == null ? null : codes.get(d.getMachineId()), hasPassword);
    }

    private void validate(DeviceConnection d) {
        if (d.getName() == null || d.getName().isBlank()) throw new IllegalArgumentException("Name is required");
        if (d.getProtocol() == null) throw new IllegalArgumentException("Protocol is required");
        if (d.getDeviceType() == null) throw new IllegalArgumentException("Device type is required");
        if (d.getProtocol() != DeviceProtocol.HTTP_PUSH) {
            if (d.getHost() == null || !d.getHost().trim().matches("[A-Za-z0-9.\\-:\\[\\]]{1,253}")) {
                throw new IllegalArgumentException("Enter a valid IP address or host name");
            }
            d.setHost(d.getHost().trim());
            if (d.getPort() == null || d.getPort() < 1 || d.getPort() > 65535) {
                throw new IllegalArgumentException("Port must be between 1 and 65535");
            }
        }
        if (d.getMachineId() != null && !machineRepo.existsById(d.getMachineId())) {
            throw new IllegalArgumentException("Mapped machine does not exist");
        }
        switch (d.getProtocol()) {
            case MQTT -> {
                if (d.getMqttTopic() == null || d.getMqttTopic().isBlank()) throw new IllegalArgumentException("MQTT topic is required");
                if (d.getMqttQos() != null && (d.getMqttQos() < 0 || d.getMqttQos() > 2)) throw new IllegalArgumentException("QoS must be 0, 1 or 2");
            }
            case MODBUS_TCP -> {
                if (d.getModbusUnitId() != null && (d.getModbusUnitId() < 0 || d.getModbusUnitId() > 247)) {
                    throw new IllegalArgumentException("Modbus unit id must be 0-247");
                }
                if (d.getPollIntervalSec() != null && (d.getPollIntervalSec() < 1 || d.getPollIntervalSec() > 3600)) {
                    throw new IllegalArgumentException("Poll interval must be 1-3600 seconds");
                }
                RegisterMap.parse(mapper, d.getRegisterMap());
            }
            default -> { }
        }
    }

    private DeviceConnection find(Long id) {
        return repo.findById(id).orElseThrow(() -> new NoSuchElementException("Device " + id + " not found"));
    }

    private String newKey() {
        byte[] b = new byte[24];
        random.nextBytes(b);
        return "dev_" + HexFormat.of().formatHex(b);
    }

    private static boolean isAdmin(Authentication a) {
        return a.getAuthorities().stream().anyMatch(g -> g.getAuthority().equals("ROLE_ADMIN"));
    }
}
