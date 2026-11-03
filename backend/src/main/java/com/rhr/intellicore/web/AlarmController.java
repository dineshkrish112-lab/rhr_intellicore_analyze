package com.rhr.intellicore.web;

import com.rhr.intellicore.domain.Alarm;
import com.rhr.intellicore.service.AlarmService;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/alarms")
public class AlarmController {

    private final AlarmService alarms;

    public AlarmController(AlarmService alarms) {
        this.alarms = alarms;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(defaultValue = "active") String status,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "10") int size) {
        Page<Alarm> p = alarms.list(!"all".equalsIgnoreCase(status), page, size);
        return Map.of("content", p.getContent(), "page", p.getNumber(), "size", p.getSize(),
                "totalElements", p.getTotalElements(), "totalPages", p.getTotalPages(),
                "activeCount", alarms.activeCount());
    }

    @PostMapping("/{id}/ack")
    public Alarm acknowledge(@PathVariable Long id, Authentication a) {
        return alarms.acknowledge(id, a.getName());
    }

    @PostMapping("/ack-all")
    public Map<String, Integer> acknowledgeAll(Authentication a) {
        return Map.of("acknowledged", alarms.acknowledgeAll(a.getName()));
    }
}
