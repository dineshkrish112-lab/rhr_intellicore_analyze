package com.rhr.intellicore.service;

import com.rhr.intellicore.dto.Dtos.ReportPage;
import com.rhr.intellicore.dto.Dtos.ReportRow;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Shift-wise production reports aggregated by day, month or year. */
@Service
public class ReportService {

    public enum Granularity { DAY, MONTH, YEAR }

    public record Criteria(Granularity granularity, LocalDate from, LocalDate to, Long machineId, String shiftCode,
                           String sort, String direction) {
        public String label() {
            return switch (granularity) {
                case DAY -> from + " to " + to;
                case MONTH -> YearMonth.from(from) + " to " + YearMonth.from(to);
                case YEAR -> from.getYear() + " to " + to.getYear();
            };
        }
    }

    private static final Map<String, String> SORTS = Map.of(
            "period", "period",
            "machine", "m.code",
            "shift", "s.shift_code",
            "production", "prod",
            "oee", "oee_sort");

    private static final String OEE_EXPR = "(sum(s.run_sec) / nullif(sum(s.run_sec + s.down_sec), 0))"
            + " * least(1, sum(s.production_kg) / nullif(sum(m.ideal_rate_kg_per_hour * s.run_sec / 3600), 0))"
            + " * ((sum(s.production_kg) - sum(s.reject_kg)) / nullif(sum(s.production_kg), 0))";

    private static final String MEASURES = """
             sum(s.run_sec) run, sum(s.down_sec) down, sum(s.production_kg) prod, sum(s.target_kg) target,
             sum(s.reject_kg) rej, sum(s.speed_sum) speed_sum, sum(s.cv_sum) cv_sum, sum(s.temp_sum) temp_sum,
             sum(s.humidity_sum) hum_sum, sum(s.samples) samples, sum(s.energy_kwh) energy, sum(s.breaks) breaks,
             sum(s.stoppages) stops, sum(m.ideal_rate_kg_per_hour * s.run_sec / 3600) ideal
            """;

    private final JdbcTemplate jdbc;

    public ReportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Criteria criteria(String granularity, String from, String to, Long machineId, String shift,
                             String sort, String direction) {
        Granularity g;
        try {
            g = Granularity.valueOf(granularity == null ? "DAY" : granularity.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("granularity must be DAY, MONTH or YEAR");
        }
        LocalDate f, t;
        try {
            switch (g) {
                case MONTH -> {
                    f = YearMonth.parse(from).atDay(1);
                    t = YearMonth.parse(to).atEndOfMonth();
                }
                case YEAR -> {
                    f = Year.parse(from).atDay(1);
                    t = Year.parse(to).atMonth(12).atEndOfMonth();
                }
                default -> {
                    f = LocalDate.parse(from);
                    t = LocalDate.parse(to);
                }
            }
        } catch (DateTimeParseException | NullPointerException e) {
            throw new IllegalArgumentException("from/to must be yyyy-MM-dd, yyyy-MM or yyyy for "
                    + g.name().toLowerCase() + " reports");
        }
        if (t.isBefore(f)) throw new IllegalArgumentException("'to' must not be before 'from'");
        String code = shift == null || shift.isBlank() || "ALL".equalsIgnoreCase(shift) ? null : shift.toUpperCase();
        return new Criteria(g, f, t, machineId, code, sort, direction);
    }

    public ReportPage page(Criteria c, int page, int size) {
        int p = Math.max(0, page);
        int sz = Math.max(1, Math.min(size, 200));
        List<Object> args = new ArrayList<>();
        String where = where(c, args);

        Long total = jdbc.queryForObject("select count(*) from (select 1 from shift_summary s join machine m on m.id = s.machine_id "
                + where + " group by " + periodExpr(c) + ", m.id, s.shift_code) t", Long.class, args.toArray());
        long totalElements = total == null ? 0 : total;

        List<ReportRow> content = rows(c, args, " limit " + sz + " offset " + ((long) p * sz));
        ReportRow totals = totals(c, args, where);
        return new ReportPage(content, p, sz, totalElements, (int) Math.ceil(totalElements / (double) sz), totals);
    }

    /** All rows for export (capped to keep files a sensible size). */
    public List<ReportRow> all(Criteria c) {
        List<Object> args = new ArrayList<>();
        where(c, args);
        return rows(c, args, " limit 100000");
    }

    public ReportRow totals(Criteria c) {
        List<Object> args = new ArrayList<>();
        String where = where(c, args);
        return totals(c, args, where);
    }

    private List<ReportRow> rows(Criteria c, List<Object> args, String limit) {
        String period = periodExpr(c);
        String sql = "select " + period + " period, m.code, m.name, m.type, s.shift_code, " + MEASURES + ", "
                + OEE_EXPR + " oee_sort from shift_summary s join machine m on m.id = s.machine_id "
                + where(c, new ArrayList<>())
                + " group by period, m.id, m.code, m.name, m.type, s.shift_code"
                + " order by " + orderBy(c) + limit;
        return jdbc.query(sql, mapper(false), args.toArray());
    }

    private ReportRow totals(Criteria c, List<Object> args, String where) {
        String sql = "select 'TOTAL' period, " + (c.machineId() != null ? "max(m.code) code, max(m.name) name, max(m.type) type"
                : "null code, null name, null type") + ", null shift_code, " + MEASURES
                + " from shift_summary s join machine m on m.id = s.machine_id " + where;
        return jdbc.queryForObject(sql, mapper(c.machineId() == null), args.toArray());
    }

    private String where(Criteria c, List<Object> args) {
        StringBuilder sb = new StringBuilder(" where s.shift_date between ? and ?");
        args.add(Date.valueOf(c.from()));
        args.add(Date.valueOf(c.to()));
        if (c.machineId() != null) {
            sb.append(" and s.machine_id = ?");
            args.add(c.machineId());
        }
        if (c.shiftCode() != null) {
            sb.append(" and s.shift_code = ?");
            args.add(c.shiftCode());
        }
        return sb.toString();
    }

    private static String periodExpr(Criteria c) {
        return switch (c.granularity()) {
            case DAY -> "date_format(s.shift_date, '%Y-%m-%d')";
            case MONTH -> "date_format(s.shift_date, '%Y-%m')";
            case YEAR -> "date_format(s.shift_date, '%Y')";
        };
    }

    private static String orderBy(Criteria c) {
        String col = SORTS.getOrDefault(c.sort() == null ? "period" : c.sort(), "period");
        String dir = "asc".equalsIgnoreCase(c.direction()) ? "asc" : "desc";
        return col + " " + dir + ", m.code asc, s.shift_code asc";
    }

    /** Speed and CV averages are meaningless across machine types, so they are blanked on mixed totals. */
    private static RowMapper<ReportRow> mapper(boolean mixedMachines) {
        return (rs, i) -> {
            double run = rs.getDouble("run"), down = rs.getDouble("down"), prod = rs.getDouble("prod");
            double rej = rs.getDouble("rej"), ideal = rs.getDouble("ideal"), target = rs.getDouble("target");
            double samples = rs.getDouble("samples");
            double a = run + down > 0 ? 100 * run / (run + down) : 0;
            double p = ideal > 0 ? Math.min(100, 100 * prod / ideal) : 0;
            double q = prod > 0 ? 100 * (prod - rej) / prod : 0;
            return new ReportRow(rs.getString("period"), rs.getString("code"), rs.getString("name"),
                    rs.getString("type"), rs.getString("shift_code"),
                    r2(run / 3600), r2(down / 3600), r2(prod), r2(target),
                    target > 0 ? r2(100 * prod / target) : 0, r2(rej),
                    samples > 0 && !mixedMachines ? r2(rs.getDouble("speed_sum") / samples) : 0,
                    samples > 0 && !mixedMachines ? r2(rs.getDouble("cv_sum") / samples) : 0,
                    samples > 0 ? r2(rs.getDouble("temp_sum") / samples) : 0,
                    samples > 0 ? r2(rs.getDouble("hum_sum") / samples) : 0,
                    r2(rs.getDouble("energy")), rs.getInt("breaks"), rs.getInt("stops"),
                    r2(a), r2(p), r2(q), r2(a * p * q / 10000));
        };
    }

    private static double r2(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
