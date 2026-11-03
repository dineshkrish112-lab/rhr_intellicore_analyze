package com.rhr.intellicore.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rhr.intellicore.dto.Dtos.DashboardSummary;
import com.rhr.intellicore.service.DashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboard;
    private final ObjectMapper mapper;

    public DashboardController(DashboardService dashboard, ObjectMapper mapper) {
        this.dashboard = dashboard;
        this.mapper = mapper;
    }

    @GetMapping("/summary")
    public DashboardSummary summary(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                    @RequestParam(required = false) String shift) {
        return dashboard.summary(date, shift);
    }

    /** The user's widget order, as saved by drag and drop. Empty object when never customised. */
    @GetMapping("/layout")
    public JsonNode layout(Authentication a) throws Exception {
        String json = dashboard.layout(a.getName());
        return json == null ? mapper.createObjectNode() : mapper.readTree(json);
    }

    @PutMapping("/layout")
    public ResponseEntity<Void> saveLayout(Authentication a, @RequestBody JsonNode body) throws Exception {
        if (!body.isObject()) throw new IllegalArgumentException("layout must be a JSON object");
        String json = mapper.writeValueAsString(body);
        if (json.length() > 8000) throw new IllegalArgumentException("layout is too large");
        dashboard.saveLayout(a.getName(), json);
        return ResponseEntity.noContent().build();
    }
}
