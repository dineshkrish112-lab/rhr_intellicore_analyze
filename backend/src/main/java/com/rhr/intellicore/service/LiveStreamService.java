package com.rhr.intellicore.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/** Pushes the live machine view to connected browsers over Server-Sent Events. */
@Service
public class LiveStreamService {

    private static final long TIMEOUT_MS = 30 * 60 * 1000L;

    private final TelemetryService telemetry;
    private final ShiftService shiftService;
    private final AlarmService alarmService;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public LiveStreamService(TelemetryService telemetry, ShiftService shiftService, AlarmService alarmService) {
        this.telemetry = telemetry;
        this.shiftService = shiftService;
        this.alarmService = alarmService;
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        emitters.add(emitter);
        send(emitter, payload());
        return emitter;
    }

    @Scheduled(fixedRate = 3000, initialDelay = 5000)
    public void broadcast() {
        if (emitters.isEmpty()) return;
        Map<String, Object> payload = payload();
        for (SseEmitter e : emitters) send(e, payload);
    }

    private Map<String, Object> payload() {
        return Map.of(
                "machines", telemetry.snapshots(),
                "shift", shiftService.current(),
                "activeAlarms", alarmService.activeCount());
    }

    private void send(SseEmitter emitter, Map<String, Object> payload) {
        try {
            emitter.send(SseEmitter.event().name("live").data(payload));
        } catch (IOException | IllegalStateException e) {
            emitters.remove(emitter);
        }
    }
}
