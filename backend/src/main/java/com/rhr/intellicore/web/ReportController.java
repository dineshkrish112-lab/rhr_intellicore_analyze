package com.rhr.intellicore.web;

import com.rhr.intellicore.dto.Dtos.ReportPage;
import com.rhr.intellicore.dto.Dtos.ReportRow;
import com.rhr.intellicore.repo.MachineRepository;
import com.rhr.intellicore.service.ExportService;
import com.rhr.intellicore.service.ReportService;
import com.rhr.intellicore.service.ReportService.Criteria;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reports;
    private final ExportService export;
    private final MachineRepository machineRepo;

    public ReportController(ReportService reports, ExportService export, MachineRepository machineRepo) {
        this.reports = reports;
        this.export = export;
        this.machineRepo = machineRepo;
    }

    @GetMapping
    public ReportPage page(@RequestParam(defaultValue = "DAY") String granularity,
                           @RequestParam String from, @RequestParam String to,
                           @RequestParam(required = false) Long machineId,
                           @RequestParam(required = false) String shift,
                           @RequestParam(defaultValue = "period") String sort,
                           @RequestParam(defaultValue = "desc") String direction,
                           @RequestParam(defaultValue = "0") int page,
                           @RequestParam(defaultValue = "10") int size) {
        return reports.page(reports.criteria(granularity, from, to, machineId, shift, sort, direction), page, size);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(defaultValue = "xlsx") String format,
                                         @RequestParam(defaultValue = "DAY") String granularity,
                                         @RequestParam String from, @RequestParam String to,
                                         @RequestParam(required = false) Long machineId,
                                         @RequestParam(required = false) String shift,
                                         @RequestParam(defaultValue = "period") String sort,
                                         @RequestParam(defaultValue = "desc") String direction) {
        Criteria c = reports.criteria(granularity, from, to, machineId, shift, sort, direction);
        List<ReportRow> rows = reports.all(c);
        ReportRow totals = reports.totals(c);
        String machineLabel = machineId == null ? "All machines"
                : machineRepo.findById(machineId).map(m -> m.getCode() + " " + m.getName()).orElse("#" + machineId);
        String base = "production-report_" + c.granularity().name().toLowerCase() + "_" + from + "_to_" + to;

        boolean pdf = "pdf".equalsIgnoreCase(format);
        if (!pdf && !"xlsx".equalsIgnoreCase(format)) throw new IllegalArgumentException("format must be pdf or xlsx");
        byte[] body = pdf ? export.pdf(rows, totals, c, machineLabel) : export.excel(rows, totals, c, machineLabel);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(base + (pdf ? ".pdf" : ".xlsx")).build().toString())
                .contentType(pdf ? MediaType.APPLICATION_PDF
                        : MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }
}
