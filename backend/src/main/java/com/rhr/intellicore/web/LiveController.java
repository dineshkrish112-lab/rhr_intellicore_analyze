package com.rhr.intellicore.web;

import com.rhr.intellicore.domain.ShiftSummary;
import com.rhr.intellicore.dto.Dtos.LiveSnapshot;
import com.rhr.intellicore.dto.Dtos.ShiftWindow;
import com.rhr.intellicore.dto.Dtos.TrendPoint;
import com.rhr.intellicore.repo.ShiftSummaryRepository;
import com.rhr.intellicore.service.LiveStreamService;
import com.rhr.intellicore.service.ShiftService;
import com.rhr.intellicore.service.TelemetryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/live")
public class LiveController {

    private final TelemetryService telemetry;
    private final LiveStreamService stream;
    private final ShiftService shiftService;
    private final ShiftSummaryRepository summaryRepo;

    public LiveController(TelemetryService telemetry, LiveStreamService stream, ShiftService shiftService,
                          ShiftSummaryRepository summaryRepo) {
        this.telemetry = telemetry;
        this.stream = stream;
        this.shiftService = shiftService;
        this.summaryRepo = summaryRepo;
    }

    @GetMapping
    public List<LiveSnapshot> all() {
        return telemetry.snapshots();
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return stream.subscribe();
    }

    @GetMapping("/{machineId}")
    public LiveSnapshot one(@PathVariable Long machineId) {
        return telemetry.snapshot(machineId);
    }

    @GetMapping("/{machineId}/trend")
    public List<TrendPoint> trend(@PathVariable Long machineId, @RequestParam(defaultValue = "120") int minutes) {
        return telemetry.trend(machineId, minutes);
    }

    /** Every shift of a production date for one machine, including upcoming ones, with their state. */
    @GetMapping("/{machineId}/shifts")
    public List<Map<String, Object>> shifts(@PathVariable Long machineId,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate day = date != null ? date : shiftService.currentProductionDate();
        LocalDateTime now = shiftService.now();
        Map<String, ShiftSummary> byCode = summaryRepo.findByMachineIdAndShiftDateOrderByShiftCodeAsc(machineId, day)
                .stream().collect(Collectors.toMap(ShiftSummary::getShiftCode, Function.identity()));
        return shiftService.windowsFor(day).stream().map(w -> {
            Map<String, Object> m = new HashMap<>();
            m.put("window", w);
            m.put("state", state(w, now));
            m.put("summary", byCode.get(w.code()));
            return m;
        }).toList();
    }

    private static String state(ShiftWindow w, LocalDateTime now) {
        if (now.isBefore(w.start())) return "UPCOMING";
        return now.isBefore(w.end()) ? "RUNNING" : "COMPLETED";
    }
}
