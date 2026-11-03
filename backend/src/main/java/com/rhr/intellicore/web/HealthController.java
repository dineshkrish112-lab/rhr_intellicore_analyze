package com.rhr.intellicore.web;

import com.rhr.intellicore.service.ShiftService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    private final ShiftService shiftService;

    public HealthController(ShiftService shiftService) {
        this.shiftService = shiftService;
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "serverTime", shiftService.now().toString());
    }
}
