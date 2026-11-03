package com.rhr.intellicore.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/**
 * Powers the dashboard builder: a whitelisted catalogue of datasets (tables), their dimension
 * and measure columns, and a query endpoint that groups and aggregates them. Only expressions
 * from the catalogue ever reach SQL; user input selects keys and supplies bound parameters.
 */
@Service
public class QueryService {

    public record Dim(String key, String label, String expr, boolean temporal) {}

    /** fixedExpr is a complete aggregate (e.g. weighted OEE); when set, the chosen aggregation is ignored. */
    public record Measure(String key, String label, String expr, String unit, String defaultAgg, String fixedExpr) {}

    public record Dataset(String key, String label, String description, String from, String dateExpr,
                          boolean timestampDate, String machineExpr, String shiftExpr,
                          List<Dim> dims, List<Measure> measures) {}

    public record DimRef(String key, String grain) {}

    public record MeasureRef(String key, String agg) {}

    public record Filters(String range, LocalDate from, LocalDate to, List<Long> machineIds, List<String> shifts) {}

    public record QueryRequest(String dataset, List<DimRef> dimensions, List<MeasureRef> measures, Filters filters,
                               String sortBy, String sortDir, Integer limit) {}

    public record Column(String key, String label, String type, String unit) {}

    public record QueryResult(List<Column> columns, List<List<Object>> rows, LocalDate from, LocalDate to, boolean truncated) {}

    private static final List<String> AGGS = List.of("SUM", "AVG", "MIN", "MAX", "COUNT");
    private static final Map<String, String> GRAINS = new LinkedHashMap<>();
    private static final List<String> RANGES = List.of("TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS",
            "THIS_MONTH", "LAST_MONTH", "THIS_YEAR", "LAST_12_MONTHS", "CUSTOM");

    static {
        GRAINS.put("hour", "%Y-%m-%d %H:00");
        GRAINS.put("day", "%Y-%m-%d");
        GRAINS.put("week", "%x-W%v");
        GRAINS.put("month", "%Y-%m");
        GRAINS.put("year", "%Y");
    }

    private static final String OEE_A = "(sum(s.run_sec) / nullif(sum(s.run_sec + s.down_sec), 0))";
    private static final String OEE_P = "least(1, sum(s.production_kg) / nullif(sum(m.ideal_rate_kg_per_hour * s.run_sec / 3600), 0))";
    private static final String OEE_Q = "((sum(s.production_kg) - sum(s.reject_kg)) / nullif(sum(s.production_kg), 0))";

    private static final Map<String, Dataset> DATASETS = new LinkedHashMap<>();

    static {
        add(new Dataset("production", "Shift production", "One row per machine per shift: output, downtime, quality and OEE.",
                "shift_summary s join machine m on m.id = s.machine_id", "s.shift_date", false, "s.machine_id", "s.shift_code",
                List.of(
                        new Dim("date", "Production date", "s.shift_date", true),
                        new Dim("shift", "Shift", "s.shift_code", false),
                        new Dim("machine", "Machine", "m.code", false),
                        new Dim("machine_type", "Machine type", "m.type", false),
                        new Dim("department", "Department", "m.department", false),
                        new Dim("line", "Line", "m.line", false),
                        new Dim("operator", "Operator", "s.operator_name", false)),
                List.of(
                        new Measure("production_kg", "Production", "s.production_kg", "kg", "SUM", null),
                        new Measure("target_kg", "Target", "s.target_kg", "kg", "SUM", null),
                        new Measure("reject_kg", "Rejects", "s.reject_kg", "kg", "SUM", null),
                        new Measure("energy_kwh", "Energy", "s.energy_kwh", "kWh", "SUM", null),
                        new Measure("run_hours", "Run time", "s.run_sec / 3600", "h", "SUM", null),
                        new Measure("down_hours", "Down time", "s.down_sec / 3600", "h", "SUM", null),
                        new Measure("breaks", "End breaks", "s.breaks", "", "SUM", null),
                        new Measure("stoppages", "Stoppages", "s.stoppages", "", "SUM", null),
                        new Measure("avg_cv", "CV %", "s.avg_cv", "%", "AVG", null),
                        new Measure("avg_speed", "Speed", "s.avg_speed", "", "AVG", null),
                        new Measure("speed_util", "Speed utilisation", "100 * s.avg_speed / m.rated_speed", "%", "AVG", null),
                        new Measure("avg_temperature", "Temperature", "s.avg_temperature", "°C", "AVG", null),
                        new Measure("avg_humidity", "Humidity", "s.avg_humidity", "%RH", "AVG", null),
                        new Measure("oee", "OEE", null, "%", "CALC", "100 * " + OEE_A + " * " + OEE_P + " * " + OEE_Q),
                        new Measure("availability", "Availability", null, "%", "CALC", "100 * " + OEE_A),
                        new Measure("performance", "Performance", null, "%", "CALC", "100 * " + OEE_P),
                        new Measure("quality", "Quality", null, "%", "CALC", "100 * " + OEE_Q),
                        new Measure("records", "Shift records", null, "", "CALC", "count(*)"))));

        add(new Dataset("telemetry", "Machine telemetry", "Raw sensor readings from devices (kept for the last 7 days).",
                "machine_reading r join machine m on m.id = r.machine_id", "r.shift_date", false, "r.machine_id", "r.shift_code",
                List.of(
                        new Dim("time", "Time", "r.ts", true),
                        new Dim("shift", "Shift", "r.shift_code", false),
                        new Dim("machine", "Machine", "m.code", false),
                        new Dim("machine_type", "Machine type", "m.type", false),
                        new Dim("department", "Department", "m.department", false),
                        new Dim("status", "Machine status", "r.status", false),
                        new Dim("source", "Data source", "r.source", false)),
                List.of(
                        new Measure("speed", "Speed", "r.speed", "", "AVG", null),
                        new Measure("cv_percent", "CV %", "r.cv_percent", "%", "AVG", null),
                        new Measure("temperature", "Temperature", "r.temperature", "°C", "AVG", null),
                        new Measure("humidity", "Humidity", "r.humidity", "%RH", "AVG", null),
                        new Measure("power_kw", "Power", "r.power_kw", "kW", "AVG", null),
                        new Measure("vibration", "Vibration", "r.vibration", "mm/s", "MAX", null),
                        new Measure("production_kg", "Production", "r.production_kg", "kg", "SUM", null),
                        new Measure("breaks", "End breaks", "r.breaks", "", "SUM", null),
                        new Measure("readings", "Readings", null, "", "CALC", "count(*)"))));

        add(new Dataset("alarms", "Alarms", "Every threshold, fault and offline event.",
                "alarm a left join machine m on m.id = a.machine_id", "a.ts", true, "a.machine_id", null,
                List.of(
                        new Dim("time", "Raised at", "a.ts", true),
                        new Dim("severity", "Severity", "a.severity", false),
                        new Dim("type", "Alarm type", "a.type", false),
                        new Dim("machine", "Machine", "a.machine_code", false),
                        new Dim("machine_type", "Machine type", "m.type", false),
                        new Dim("state", "State", "case when a.acknowledged then 'Acknowledged' else 'Open' end", false)),
                List.of(
                        new Measure("alarms", "Alarms", null, "", "CALC", "count(*)"),
                        new Measure("open_alarms", "Open alarms", null, "", "CALC", "sum(case when a.acknowledged then 0 else 1 end)"),
                        new Measure("value", "Recorded value", "a.value", "", "AVG", null))));

        add(new Dataset("machines", "Machine master", "Installed machines and their rated capacity.",
                "machine m", null, false, "m.id", null,
                List.of(
                        new Dim("machine", "Machine", "m.code", false),
                        new Dim("machine_type", "Machine type", "m.type", false),
                        new Dim("department", "Department", "m.department", false),
                        new Dim("line", "Line", "m.line", false),
                        new Dim("make", "Make", "m.make", false)),
                List.of(
                        new Measure("machines", "Machines", null, "", "CALC", "count(*)"),
                        new Measure("ideal_rate", "Ideal output", "m.ideal_rate_kg_per_hour", "kg/h", "SUM", null),
                        new Measure("rated_speed", "Rated speed", "m.rated_speed", "", "AVG", null),
                        new Measure("target_cv", "Target CV %", "m.target_cv", "%", "AVG", null),
                        new Measure("spindles", "Spindles", "m.spindles", "", "SUM", null))));
    }

    private static void add(Dataset d) {
        DATASETS.put(d.key(), d);
    }

    private final JdbcTemplate jdbc;
    private final ShiftService shiftService;

    public QueryService(JdbcTemplate jdbc, ShiftService shiftService) {
        this.jdbc = jdbc;
        this.shiftService = shiftService;
    }

    public Map<String, Object> catalog() {
        List<Map<String, Object>> sets = DATASETS.values().stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", d.key());
            m.put("label", d.label());
            m.put("description", d.description());
            m.put("hasDate", d.dateExpr() != null);
            m.put("hasShift", d.shiftExpr() != null);
            m.put("dimensions", d.dims().stream().map(x -> Map.of("key", x.key(), "label", x.label(), "temporal", x.temporal())).toList());
            m.put("measures", d.measures().stream().map(x -> Map.of("key", x.key(), "label", x.label(), "unit", x.unit(),
                    "defaultAgg", x.defaultAgg(), "calculated", x.fixedExpr() != null)).toList());
            return m;
        }).toList();
        return Map.of("datasets", sets, "aggregations", AGGS, "grains", GRAINS.keySet(), "ranges", RANGES);
    }

    public QueryResult run(QueryRequest req) {
        Dataset ds = Optional.ofNullable(req.dataset()).map(DATASETS::get)
                .orElseThrow(() -> new IllegalArgumentException("Choose a data table"));
        List<DimRef> dims = req.dimensions() == null ? List.of() : req.dimensions();
        List<MeasureRef> measures = req.measures() == null ? List.of() : req.measures();
        if (dims.size() > 2) throw new IllegalArgumentException("Use at most two group-by columns");
        if (measures.isEmpty()) throw new IllegalArgumentException("Pick at least one value column");
        if (measures.size() > 6) throw new IllegalArgumentException("Use at most six value columns");

        List<String> select = new ArrayList<>();
        List<Column> columns = new ArrayList<>();
        List<String> groupBy = new ArrayList<>();
        for (int i = 0; i < dims.size(); i++) {
            DimRef ref = dims.get(i);
            Dim d = ds.dims().stream().filter(x -> x.key().equals(ref.key())).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown column " + ref.key() + " in " + ds.label()));
            String expr = d.expr();
            String label = d.label();
            if (d.temporal()) {
                String grain = ref.grain() == null ? "day" : ref.grain();
                String fmt = GRAINS.get(grain);
                if (fmt == null) throw new IllegalArgumentException("Unknown time grain " + grain);
                expr = "date_format(" + d.expr() + ", '" + fmt + "')";
                label = label + " (" + grain + ")";
            }
            select.add("coalesce(" + expr + ", '(blank)') as d" + i);
            groupBy.add("d" + i);
            columns.add(new Column("d" + i, label, d.temporal() ? "time" : "text", null));
        }
        for (int i = 0; i < measures.size(); i++) {
            MeasureRef ref = measures.get(i);
            Measure m = ds.measures().stream().filter(x -> x.key().equals(ref.key())).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown value " + ref.key() + " in " + ds.label()));
            String agg = m.fixedExpr() != null ? null : (ref.agg() == null ? m.defaultAgg() : ref.agg().toUpperCase());
            if (agg != null && !AGGS.contains(agg)) throw new IllegalArgumentException("Unknown aggregation " + agg);
            String expr = m.fixedExpr() != null ? m.fixedExpr() : agg.toLowerCase() + "(" + m.expr() + ")";
            select.add("round(" + expr + ", 2) as m" + i);
            String label = m.fixedExpr() != null ? m.label() : aggLabel(agg) + " " + m.label();
            columns.add(new Column("m" + i, label, "number", "COUNT".equals(agg) ? "" : m.unit()));
        }

        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        Filters f = req.filters() == null ? new Filters("LAST_30_DAYS", null, null, null, null) : req.filters();
        LocalDate[] range = null;
        if (ds.dateExpr() != null) {
            range = resolveRange(f);
            if (ds.timestampDate()) {
                where.append(" and ").append(ds.dateExpr()).append(" >= ? and ").append(ds.dateExpr()).append(" < ?");
                args.add(Timestamp.valueOf(range[0].atStartOfDay()));
                args.add(Timestamp.valueOf(range[1].plusDays(1).atStartOfDay()));
            } else {
                where.append(" and ").append(ds.dateExpr()).append(" between ? and ?");
                args.add(Date.valueOf(range[0]));
                args.add(Date.valueOf(range[1]));
            }
        }
        if (f.machineIds() != null && !f.machineIds().isEmpty()) {
            where.append(" and ").append(ds.machineExpr()).append(" in (")
                    .append(String.join(",", Collections.nCopies(f.machineIds().size(), "?"))).append(")");
            args.addAll(f.machineIds());
        }
        if (ds.shiftExpr() != null && f.shifts() != null && !f.shifts().isEmpty()) {
            List<String> shifts = f.shifts().stream().map(String::toUpperCase).filter(s -> s.matches("[A-Z]{1,4}")).toList();
            if (!shifts.isEmpty()) {
                where.append(" and ").append(ds.shiftExpr()).append(" in (")
                        .append(String.join(",", Collections.nCopies(shifts.size(), "?"))).append(")");
                args.addAll(shifts);
            }
        }

        int limit = req.limit() == null ? 500 : Math.max(1, Math.min(2000, req.limit()));
        StringBuilder sql = new StringBuilder("select ").append(String.join(", ", select))
                .append(" from ").append(ds.from()).append(where);
        if (!groupBy.isEmpty()) sql.append(" group by ").append(String.join(", ", groupBy));
        sql.append(" order by ").append(orderBy(req, columns)).append(" limit ").append(limit + 1);

        List<Map<String, Object>> raw = jdbc.queryForList(sql.toString(), args.toArray());
        boolean truncated = raw.size() > limit;
        List<List<Object>> rows = new ArrayList<>();
        for (Map<String, Object> r : raw.subList(0, Math.min(limit, raw.size()))) {
            List<Object> row = new ArrayList<>();
            for (Column c : columns) {
                Object v = r.get(c.key());
                row.add(v instanceof BigDecimal b ? b.doubleValue() : v instanceof Number n ? n.doubleValue() : v);
            }
            rows.add(row);
        }
        return new QueryResult(columns, rows, range == null ? null : range[0], range == null ? null : range[1], truncated);
    }

    private static String orderBy(QueryRequest req, List<Column> columns) {
        String dir = "asc".equalsIgnoreCase(req.sortDir()) ? "asc" : "desc";
        if (req.sortBy() != null && columns.stream().anyMatch(c -> c.key().equals(req.sortBy()))) {
            return req.sortBy() + " " + dir;
        }
        // Time axes read left to right; categories default to the largest value first.
        Optional<Column> time = columns.stream().filter(c -> "time".equals(c.type())).findFirst();
        if (time.isPresent()) return time.get().key() + " asc";
        return columns.stream().filter(c -> "number".equals(c.type())).findFirst().map(c -> c.key() + " desc").orElse("1");
    }

    private LocalDate[] resolveRange(Filters f) {
        LocalDate today = shiftService.currentProductionDate();
        String r = f.range() == null ? "LAST_30_DAYS" : f.range().toUpperCase();
        return switch (r) {
            case "TODAY" -> new LocalDate[]{today, today};
            case "YESTERDAY" -> new LocalDate[]{today.minusDays(1), today.minusDays(1)};
            case "LAST_7_DAYS" -> new LocalDate[]{today.minusDays(6), today};
            case "LAST_30_DAYS" -> new LocalDate[]{today.minusDays(29), today};
            case "THIS_MONTH" -> new LocalDate[]{today.withDayOfMonth(1), today};
            case "LAST_MONTH" -> {
                YearMonth lm = YearMonth.from(today).minusMonths(1);
                yield new LocalDate[]{lm.atDay(1), lm.atEndOfMonth()};
            }
            case "THIS_YEAR" -> new LocalDate[]{today.withDayOfYear(1), today};
            case "LAST_12_MONTHS" -> new LocalDate[]{today.minusMonths(12).plusDays(1), today};
            case "CUSTOM" -> {
                if (f.from() == null || f.to() == null) throw new IllegalArgumentException("Custom range needs from and to dates");
                if (f.to().isBefore(f.from())) throw new IllegalArgumentException("'to' must not be before 'from'");
                yield new LocalDate[]{f.from(), f.to()};
            }
            default -> throw new IllegalArgumentException("Unknown date range " + f.range());
        };
    }

    private static String aggLabel(String agg) {
        return switch (agg) {
            case "SUM" -> "Total";
            case "AVG" -> "Avg";
            case "MIN" -> "Min";
            case "MAX" -> "Max";
            default -> "Count of";
        };
    }
}
