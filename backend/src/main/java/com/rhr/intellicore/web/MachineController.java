package com.rhr.intellicore.web;

import com.rhr.intellicore.domain.Machine;
import com.rhr.intellicore.dto.Dtos.MachineRequest;
import com.rhr.intellicore.repo.MachineRepository;
import com.rhr.intellicore.service.TelemetryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;

/** Machine master. New machines start receiving telemetry as soon as they are registered here. */
@RestController
@RequestMapping("/api/machines")
public class MachineController {

    private final MachineRepository repo;
    private final TelemetryService telemetry;

    public MachineController(MachineRepository repo, TelemetryService telemetry) {
        this.repo = repo;
        this.telemetry = telemetry;
    }

    @GetMapping
    public List<Machine> list() {
        return repo.findAllByOrderByCodeAsc();
    }

    @GetMapping("/{id}")
    public Machine get(@PathVariable Long id) {
        return repo.findById(id).orElseThrow(() -> new NoSuchElementException("Machine " + id + " not found"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public Machine create(@Valid @RequestBody MachineRequest req) {
        if (repo.existsByCodeIgnoreCase(req.code())) {
            throw new IllegalArgumentException("Machine code " + req.code() + " already exists");
        }
        Machine m = apply(new Machine(), req);
        m = repo.save(m);
        telemetry.refreshMachines();
        return m;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Machine update(@PathVariable Long id, @Valid @RequestBody MachineRequest req) {
        Machine m = get(id);
        repo.findByCodeIgnoreCase(req.code()).filter(o -> !o.getId().equals(id)).ifPresent(o -> {
            throw new IllegalArgumentException("Machine code " + req.code() + " already exists");
        });
        m = repo.save(apply(m, req));
        telemetry.refreshMachines();
        return m;
    }

    private static Machine apply(Machine m, MachineRequest r) {
        m.setCode(r.code().trim().toUpperCase());
        m.setName(r.name());
        m.setType(r.type());
        m.setDepartment(r.department());
        m.setLine(r.line());
        m.setMake(r.make());
        m.setModel(r.model());
        m.setSpindles(r.spindles());
        m.setRatedSpeed(r.ratedSpeed());
        m.setSpeedUnit(r.speedUnit());
        m.setIdealRateKgPerHour(r.idealRateKgPerHour());
        m.setTargetCv(r.targetCv());
        m.setMaxTemperature(r.maxTemperature());
        m.setInstalledOn(r.installedOn());
        if (r.enabled() != null) m.setEnabled(r.enabled());
        return m;
    }
}
