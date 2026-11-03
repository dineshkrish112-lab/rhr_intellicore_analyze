package com.rhr.intellicore.web;

import com.rhr.intellicore.domain.ShiftDefinition;
import com.rhr.intellicore.dto.Dtos.CurrentShift;
import com.rhr.intellicore.dto.Dtos.ShiftUpdateRequest;
import com.rhr.intellicore.service.ShiftService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shifts")
public class ShiftController {

    private final ShiftService shifts;

    public ShiftController(ShiftService shifts) {
        this.shifts = shifts;
    }

    @GetMapping
    public List<ShiftDefinition> list() {
        return shifts.definitions();
    }

    @GetMapping("/current")
    public CurrentShift current() {
        return shifts.current();
    }

    @PutMapping("/{code}")
    @PreAuthorize("hasRole('ADMIN')")
    public ShiftDefinition update(@PathVariable String code, @Valid @RequestBody ShiftUpdateRequest req) {
        return shifts.update(code, req);
    }
}
