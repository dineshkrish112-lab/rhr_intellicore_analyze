package com.rhr.intellicore.service;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfWriter;
import com.rhr.intellicore.domain.PlantProfile;
import com.rhr.intellicore.dto.Dtos.ReportRow;
import com.rhr.intellicore.repo.PlantProfileRepository;
import com.rhr.intellicore.service.ReportService.Criteria;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.function.Function;

/** Renders report rows as an Excel workbook or a landscape PDF. */
@Service
public class ExportService {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");
    private static final Color BRAND = new Color(0x8b, 0x5c, 0xf6);

    private record Col(String header, Function<ReportRow, Object> value, boolean numeric) {}

    private static final List<Col> COLUMNS = List.of(
            new Col("Period", ReportRow::period, false),
            new Col("Machine", ReportRow::machineCode, false),
            new Col("Type", ReportRow::machineType, false),
            new Col("Shift", ReportRow::shiftCode, false),
            new Col("Run h", ReportRow::runHours, true),
            new Col("Down h", ReportRow::downHours, true),
            new Col("Production kg", ReportRow::productionKg, true),
            new Col("Target kg", ReportRow::targetKg, true),
            new Col("Achv %", ReportRow::achievement, true),
            new Col("Reject kg", ReportRow::rejectKg, true),
            new Col("Avg Speed", ReportRow::avgSpeed, true),
            new Col("CV %", ReportRow::avgCv, true),
            new Col("Temp °C", ReportRow::avgTemperature, true),
            new Col("RH %", ReportRow::avgHumidity, true),
            new Col("Energy kWh", ReportRow::energyKwh, true),
            new Col("Breaks", ReportRow::breaks, true),
            new Col("Stops", ReportRow::stoppages, true),
            new Col("Avail %", ReportRow::availability, true),
            new Col("Perf %", ReportRow::performance, true),
            new Col("Quality %", ReportRow::quality, true),
            new Col("OEE %", ReportRow::oee, true));

    private final PlantProfileRepository plantRepo;
    private final ShiftService shiftService;

    public ExportService(PlantProfileRepository plantRepo, ShiftService shiftService) {
        this.plantRepo = plantRepo;
        this.shiftService = shiftService;
    }

    public byte[] excel(List<ReportRow> rows, ReportRow totals, Criteria c, String machineLabel) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Production Report");
            PlantProfile plant = plant();

            org.apache.poi.ss.usermodel.Font titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            CellStyle title = wb.createCellStyle();
            title.setFont(titleFont);

            org.apache.poi.ss.usermodel.Font headFont = wb.createFont();
            headFont.setBold(true);
            headFont.setColor(IndexedColors.WHITE.getIndex());
            CellStyle head = wb.createCellStyle();
            head.setFont(headFont);
            head.setFillForegroundColor(IndexedColors.VIOLET.getIndex());
            head.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            head.setAlignment(HorizontalAlignment.CENTER);

            CellStyle num = wb.createCellStyle();
            num.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
            org.apache.poi.ss.usermodel.Font boldFont = wb.createFont();
            boldFont.setBold(true);
            CellStyle totalNum = wb.createCellStyle();
            totalNum.cloneStyleFrom(num);
            totalNum.setFont(boldFont);
            totalNum.setBorderTop(BorderStyle.THIN);
            CellStyle totalText = wb.createCellStyle();
            totalText.setFont(boldFont);
            totalText.setBorderTop(BorderStyle.THIN);

            int r = 0;
            cell(sheet.createRow(r++), 0, plant.getCompanyName() + " - " + plant.getPlantName(), title);
            cell(sheet.createRow(r++), 0, "Shift-wise Production Report (" + c.granularity().name().toLowerCase()
                    + "): " + c.label(), null);
            cell(sheet.createRow(r++), 0, "Machine: " + machineLabel + "   Shift: "
                    + (c.shiftCode() == null ? "All" : c.shiftCode()) + "   Generated: " + now(), null);
            r++;

            int headerRow = r;
            Row hr = sheet.createRow(r++);
            for (int i = 0; i < COLUMNS.size(); i++) cell(hr, i, COLUMNS.get(i).header(), head);

            for (ReportRow row : rows) {
                Row xr = sheet.createRow(r++);
                for (int i = 0; i < COLUMNS.size(); i++) {
                    Col col = COLUMNS.get(i);
                    Object v = col.value().apply(row);
                    if (col.numeric() && v instanceof Number n) {
                        Cell cl = xr.createCell(i);
                        cl.setCellValue(n.doubleValue());
                        cl.setCellStyle(num);
                    } else cell(xr, i, v == null ? "" : v.toString(), null);
                }
            }
            if (!rows.isEmpty()) {
                sheet.setAutoFilter(new CellRangeAddress(headerRow, r - 1, 0, COLUMNS.size() - 1));
            }
            Row tr = sheet.createRow(r);
            for (int i = 0; i < COLUMNS.size(); i++) {
                Col col = COLUMNS.get(i);
                Object v = i == 0 ? "TOTAL" : col.value().apply(totals);
                if (col.numeric() && v instanceof Number n) {
                    Cell cl = tr.createCell(i);
                    cl.setCellValue(n.doubleValue());
                    cl.setCellStyle(totalNum);
                } else cell(tr, i, v == null ? "" : v.toString(), totalText);
            }
            sheet.createFreezePane(0, headerRow + 1);
            for (int i = 0; i < COLUMNS.size(); i++) sheet.setColumnWidth(i, i < 4 ? 14 * 256 : 12 * 256);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public byte[] pdf(List<ReportRow> rows, ReportRow totals, Criteria c, String machineLabel) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4.rotate(), 18, 18, 24, 30);
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        PlantProfile plant = plant();
        writer.setPageEvent(new PdfPageEventHelper() {
            @Override
            public void onEndPage(PdfWriter w, Document d) {
                Font f = FontFactory.getFont(FontFactory.HELVETICA, 7, Color.GRAY);
                ColumnText.showTextAligned(w.getDirectContent(), Element.ALIGN_LEFT,
                        new Phrase(plant.getCompanyName() + " | Generated " + now(), f), d.left(), d.bottom() - 14, 0);
                ColumnText.showTextAligned(w.getDirectContent(), Element.ALIGN_RIGHT,
                        new Phrase("Page " + w.getPageNumber(), f), d.right(), d.bottom() - 14, 0);
            }
        });
        doc.open();

        Font h1 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, BRAND);
        Font meta = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
        doc.add(new Paragraph(plant.getCompanyName() + " - " + plant.getPlantName(), h1));
        doc.add(new Paragraph("Shift-wise Production Report (" + c.granularity().name().toLowerCase() + "): "
                + c.label() + "    Machine: " + machineLabel + "    Shift: "
                + (c.shiftCode() == null ? "All" : c.shiftCode()), meta));
        doc.add(new Paragraph(String.format("Production %.1f kg   |   OEE %.1f%%   |   Availability %.1f%%   |   "
                        + "Performance %.1f%%   |   Quality %.1f%%   |   Energy %.0f kWh",
                totals.productionKg(), totals.oee(), totals.availability(), totals.performance(), totals.quality(),
                totals.energyKwh()), meta));
        doc.add(Chunk.NEWLINE);

        PdfPTable table = new PdfPTable(COLUMNS.size());
        table.setWidthPercentage(100);
        table.setHeaderRows(1);
        float[] widths = new float[COLUMNS.size()];
        for (int i = 0; i < widths.length; i++) widths[i] = i == 0 ? 1.6f : i == 2 ? 1.5f : 1f;
        table.setWidths(widths);

        Font headF = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 6.5f, Color.WHITE);
        Font bodyF = FontFactory.getFont(FontFactory.HELVETICA, 6.5f, Color.BLACK);
        Font totalF = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 6.5f, Color.BLACK);
        for (Col col : COLUMNS) {
            PdfPCell cell = new PdfPCell(new Phrase(col.header(), headF));
            cell.setBackgroundColor(BRAND);
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            cell.setPadding(4);
            table.addCell(cell);
        }
        Color stripe = new Color(245, 243, 255);
        for (int r = 0; r < rows.size(); r++) {
            for (Col col : COLUMNS) {
                PdfPCell cell = pdfCell(col, col.value().apply(rows.get(r)), bodyF);
                if (r % 2 == 1) cell.setBackgroundColor(stripe);
                table.addCell(cell);
            }
        }
        for (int i = 0; i < COLUMNS.size(); i++) {
            Col col = COLUMNS.get(i);
            PdfPCell cell = pdfCell(col, i == 0 ? "TOTAL" : col.value().apply(totals), totalF);
            cell.setBackgroundColor(new Color(237, 233, 254));
            table.addCell(cell);
        }
        doc.add(table);
        doc.close();
        return out.toByteArray();
    }

    private static PdfPCell pdfCell(Col col, Object v, Font font) {
        String text;
        if (v == null) text = "";
        else if (v instanceof Double d) text = d == 0 && (col.header().equals("Avg Speed") || col.header().equals("CV %"))
                ? "-" : String.format("%,.2f", d);
        else text = v.toString();
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(col.numeric() ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
        cell.setPadding(3);
        cell.setBorderColor(new Color(226, 232, 240));
        return cell;
    }

    private static void cell(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value);
        if (style != null) c.setCellStyle(style);
    }

    private PlantProfile plant() {
        return plantRepo.findFirstByOrderByIdAsc().orElseGet(() -> {
            PlantProfile p = new PlantProfile();
            p.setCompanyName("RHR Intellicore");
            p.setPlantName("Plant");
            return p;
        });
    }

    private String now() {
        LocalDateTime t = shiftService.now();
        return t.format(STAMP);
    }
}
