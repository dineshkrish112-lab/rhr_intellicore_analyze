package com.rhr.intellicore.service;

import com.rhr.intellicore.config.AppProperties;
import com.rhr.intellicore.domain.ShiftDefinition;
import com.rhr.intellicore.dto.Dtos.CurrentShift;
import com.rhr.intellicore.dto.Dtos.ShiftUpdateRequest;
import com.rhr.intellicore.dto.Dtos.ShiftWindow;
import com.rhr.intellicore.repo.ShiftDefinitionRepository;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Resolves which shift a timestamp belongs to. A shift that crosses midnight (e.g. C 22:00-06:00)
 * is booked against the date it started on, which is the convention used on mill shift registers.
 */
@Service
public class ShiftService {

    private final ShiftDefinitionRepository repo;
    private final ZoneId zone;
    private volatile List<ShiftDefinition> cache = List.of();

    public ShiftService(ShiftDefinitionRepository repo, AppProperties props) {
        this.repo = repo;
        this.zone = ZoneId.of(props.timezone());
    }

    public ZoneId zone() {
        return zone;
    }

    public LocalDateTime now() {
        return LocalDateTime.now(zone);
    }

    public void reload() {
        cache = repo.findAll().stream().sorted(Comparator.comparing(ShiftDefinition::getStartTime)).toList();
    }

    public List<ShiftDefinition> definitions() {
        if (cache.isEmpty()) reload();
        return cache;
    }

    public ShiftDefinition definition(String code) {
        return definitions().stream().filter(s -> s.getCode().equalsIgnoreCase(code)).findFirst()
                .orElseThrow(() -> new NoSuchElementException("Unknown shift " + code));
    }

    public ShiftWindow window(ShiftDefinition def, LocalDate shiftDate) {
        LocalDateTime start = shiftDate.atTime(def.getStartTime());
        LocalDateTime end = def.getEndTime().isAfter(def.getStartTime())
                ? shiftDate.atTime(def.getEndTime())
                : shiftDate.plusDays(1).atTime(def.getEndTime());
        return new ShiftWindow(def.getCode(), def.getName(), def.getColor(), shiftDate, start, end);
    }

    public ShiftWindow resolve(LocalDateTime ts) {
        for (LocalDate d : List.of(ts.toLocalDate(), ts.toLocalDate().minusDays(1))) {
            for (ShiftDefinition def : definitions()) {
                ShiftWindow w = window(def, d);
                if (!ts.isBefore(w.start()) && ts.isBefore(w.end())) return w;
            }
        }
        // Gap in configured shifts: book against the first shift of the day.
        return window(definitions().get(0), ts.toLocalDate());
    }

    /** Windows for every shift of a production date, in shift order. */
    public List<ShiftWindow> windowsFor(LocalDate date) {
        return definitions().stream().map(d -> window(d, date)).toList();
    }

    public long plannedSeconds(String code) {
        ShiftWindow w = window(definition(code), LocalDate.of(2000, 1, 1));
        return Duration.between(w.start(), w.end()).toSeconds();
    }

    /** Production date of "now": the date the current shift started on. */
    public LocalDate currentProductionDate() {
        return resolve(now()).shiftDate();
    }

    public CurrentShift current() {
        LocalDateTime now = now();
        ShiftWindow w = resolve(now);
        ShiftWindow next = resolve(w.end());
        long total = Duration.between(w.start(), w.end()).toSeconds();
        long elapsed = Duration.between(w.start(), now).toSeconds();
        return new CurrentShift(w, next, now, elapsed, Math.max(0, total - elapsed),
                total > 0 ? Math.round(1000.0 * elapsed / total) / 10.0 : 0);
    }

    public ShiftDefinition update(String code, ShiftUpdateRequest req) {
        ShiftDefinition def = repo.findById(code.toUpperCase())
                .orElseThrow(() -> new NoSuchElementException("Unknown shift " + code));
        def.setName(req.name());
        def.setStartTime(LocalTime.parse(req.startTime()));
        def.setEndTime(LocalTime.parse(req.endTime()));
        if (req.color() != null) def.setColor(req.color());
        def.setInCharge(req.inCharge());
        repo.save(def);
        reload();
        return def;
    }
}
