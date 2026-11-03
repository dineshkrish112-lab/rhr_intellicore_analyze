package com.rhr.intellicore.service;

import com.rhr.intellicore.config.AppProperties;
import com.rhr.intellicore.domain.*;
import com.rhr.intellicore.domain.Enums.DeviceProtocol;
import com.rhr.intellicore.domain.Enums.DeviceType;
import com.rhr.intellicore.domain.Enums.Role;
import com.rhr.intellicore.dto.Dtos.ShiftWindow;
import com.rhr.intellicore.dto.Dtos.TelemetryRequest;
import com.rhr.intellicore.repo.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.Consumer;

/**
 * First-run bootstrap: static users, plant profile, shift pattern, machine master, plus
 * back-filled shift history and recent telemetry so dashboards and reports have data on day one.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final AppUserRepository userRepo;
    private final PlantProfileRepository plantRepo;
    private final ShiftDefinitionRepository shiftRepo;
    private final MachineRepository machineRepo;
    private final ShiftSummaryRepository summaryRepo;
    private final PasswordEncoder encoder;
    private final ShiftService shiftService;
    private final SimulatorService simulator;
    private final JdbcTemplate jdbc;
    private final AppProperties props;
    private final DeviceConnectionRepository deviceRepo;
    private final CustomDashboardRepository dashboardRepo;

    public DataSeeder(AppUserRepository userRepo, PlantProfileRepository plantRepo, ShiftDefinitionRepository shiftRepo,
                      MachineRepository machineRepo, ShiftSummaryRepository summaryRepo, PasswordEncoder encoder,
                      ShiftService shiftService, SimulatorService simulator, JdbcTemplate jdbc, AppProperties props,
                      DeviceConnectionRepository deviceRepo, CustomDashboardRepository dashboardRepo) {
        this.userRepo = userRepo;
        this.plantRepo = plantRepo;
        this.shiftRepo = shiftRepo;
        this.machineRepo = machineRepo;
        this.summaryRepo = summaryRepo;
        this.encoder = encoder;
        this.shiftService = shiftService;
        this.simulator = simulator;
        this.jdbc = jdbc;
        this.props = props;
        this.deviceRepo = deviceRepo;
        this.dashboardRepo = dashboardRepo;
    }

    @Override
    public void run(String... args) {
        if (userRepo.count() == 0) seedUsers();
        if (plantRepo.count() == 0) seedPlant();
        if (shiftRepo.count() == 0) seedShifts();
        shiftService.reload();
        if (machineRepo.count() == 0) seedMachines();
        if (deviceRepo.count() == 0) seedDevices();
        if (dashboardRepo.count() == 0) seedDashboard();
        if (summaryRepo.count() == 0) {
            List<Machine> machines = machineRepo.findAllByOrderByCodeAsc();
            seedHistory(machines);
            seedRecentReadings(machines);
            seedAlarms(machines);
        }
    }

    private void seedUsers() {
        userRepo.saveAll(List.of(
                user("admin", "Admin@123", "Dinesh Kumar", "9876543210", "admin@rhrtextiles.in", Role.ADMIN,
                        "Plant Head", "Management", "RHR-1001", "General"),
                user("supervisor", "Super@123", "Arun Prakash", "9876543211", "arun@rhrtextiles.in", Role.SUPERVISOR,
                        "Shift Supervisor", "Spinning", "RHR-1042", "A"),
                user("operator", "Oper@123", "Aswin Raj", "9876543212", "aswin@rhrtextiles.in", Role.OPERATOR,
                        "Machine Operator", "Ring Frame", "RHR-1187", "B")));
        log.info("Seeded static users: admin / supervisor / operator");
    }

    private AppUser user(String username, String password, String name, String mobile, String email, Role role,
                         String designation, String dept, String empId, String shift) {
        AppUser u = new AppUser();
        u.setUsername(username);
        u.setPasswordHash(encoder.encode(password));
        u.setFullName(name);
        u.setMobile(mobile);
        u.setEmail(email);
        u.setRole(role);
        u.setDesignation(designation);
        u.setDepartment(dept);
        u.setEmployeeId(empId);
        u.setAssignedShift(shift);
        return u;
    }

    private void seedPlant() {
        PlantProfile p = new PlantProfile();
        p.setCompanyName("RHR Textiles Pvt. Ltd.");
        p.setPlantName("Intellicore Spinning Unit 1");
        p.setPlantCode("RHR-SPU-01");
        p.setIndustry("Textile - Cotton Yarn Spinning");
        p.setAddress("SF No. 214, Avinashi Road, Neelambur");
        p.setCity("Coimbatore");
        p.setState("Tamil Nadu");
        p.setCountry("India");
        p.setPincode("641062");
        p.setGstin("33AABCR1234F1Z5");
        p.setContactEmail("plant1@rhrtextiles.in");
        p.setContactPhone("+91 422 4567890");
        p.setPlantManager("Dinesh Kumar");
        p.setEstablishedYear(2009);
        p.setInstalledSpindles(7296);
        p.setWorkforce(240);
        p.setPowerSanctionedKw(1500.0);
        p.setCertifications("ISO 9001:2015, ISO 14001:2015, OEKO-TEX Standard 100");
        p.setTimezone(props.timezone());
        plantRepo.save(p);
    }

    private void seedShifts() {
        shiftRepo.saveAll(List.of(
                shift("A", "Shift A (Morning)", "06:00", "14:00", "#2a78d6", "Arun Prakash"),
                shift("B", "Shift B (Afternoon)", "14:00", "22:00", "#eb6834", "Vignesh S"),
                shift("C", "Shift C (Night)", "22:00", "06:00", "#1baf7a", "Saravanan M")));
    }

    private ShiftDefinition shift(String code, String name, String start, String end, String color, String inCharge) {
        ShiftDefinition s = new ShiftDefinition();
        s.setCode(code);
        s.setName(name);
        s.setStartTime(LocalTime.parse(start));
        s.setEndTime(LocalTime.parse(end));
        s.setColor(color);
        s.setInCharge(inCharge);
        return s;
    }

    private void seedMachines() {
        List<Machine> list = new ArrayList<>();
        list.add(machine("CD-01", "Carding Machine 01", "Carding", "Preparatory", "Line 1", "LMW", "LC 363", null, 220, "m/min", 60, 3.5, 45));
        list.add(machine("CD-02", "Carding Machine 02", "Carding", "Preparatory", "Line 2", "LMW", "LC 363", null, 220, "m/min", 60, 3.5, 45));
        list.add(machine("DF-01", "Draw Frame 01", "Draw Frame", "Preparatory", "Line 1", "Rieter", "RSB-D 50", null, 600, "m/min", 90, 3.0, 42));
        list.add(machine("DF-02", "Draw Frame 02", "Draw Frame", "Preparatory", "Line 2", "Rieter", "RSB-D 50", null, 600, "m/min", 90, 3.0, 42));
        list.add(machine("SX-01", "Simplex 01", "Simplex", "Preparatory", "Line 1", "LMW", "LF 4280", 160, 1200, "rpm", 45, 4.0, 42));
        list.add(machine("SX-02", "Simplex 02", "Simplex", "Preparatory", "Line 2", "LMW", "LF 4280", 160, 1200, "rpm", 45, 4.0, 42));
        for (int i = 1; i <= 4; i++) {
            list.add(machine("RF-0" + i, "Ring Frame 0" + i, "Ring Frame", "Spinning", "Line " + ((i + 1) / 2),
                    "LMW", "LR 9 SXL", 1824, 18500, "rpm", 22, 11.5, 40));
        }
        list.add(machine("AC-01", "Autoconer 01", "Autoconer", "Winding", "Line 1", "Savio", "Polar Evolution", 60, 1400, "m/min", 40, 12.0, 38));
        list.add(machine("AC-02", "Autoconer 02", "Autoconer", "Winding", "Line 2", "Savio", "Polar Evolution", 60, 1400, "m/min", 40, 12.0, 38));
        machineRepo.saveAll(list);
    }

    private Machine machine(String code, String name, String type, String dept, String line, String make, String model,
                            Integer spindles, double rated, String unit, double ideal, double cv, double maxTemp) {
        Machine m = new Machine();
        m.setCode(code);
        m.setName(name);
        m.setType(type);
        m.setDepartment(dept);
        m.setLine(line);
        m.setMake(make);
        m.setModel(model);
        m.setSpindles(spindles);
        m.setRatedSpeed(rated);
        m.setSpeedUnit(unit);
        m.setIdealRateKgPerHour(ideal);
        m.setTargetCv(cv);
        m.setMaxTemperature(maxTemp);
        m.setInstalledOn(LocalDate.of(2009 + (int) (Math.abs(code.hashCode()) % 12), 4, 1));
        return m;
    }

    /**
     * Example field devices with typical plant-network addresses. They start switched off so the
     * simulator keeps feeding data until real IPs are entered and a connector is enabled.
     */
    private void seedDevices() {
        Map<String, Long> ids = new HashMap<>();
        machineRepo.findAll().forEach(m -> ids.put(m.getCode(), m.getId()));
        String registerMap = "{\"status\":{\"address\":0},\"speed\":{\"address\":1,\"scale\":1},"
                + "\"cvPercent\":{\"address\":2,\"scale\":0.01},\"temperature\":{\"address\":3,\"scale\":0.1},"
                + "\"humidity\":{\"address\":4,\"scale\":0.1},\"powerKw\":{\"address\":5,\"scale\":0.1},"
                + "\"vibration\":{\"address\":6,\"scale\":0.1},\"productionCounter\":{\"address\":7,\"scale\":0.01},"
                + "\"breaksCounter\":{\"address\":8}}";
        List<DeviceConnection> list = new ArrayList<>();
        list.add(device("Spinning MQTT Gateway", DeviceType.IOT_GATEWAY, DeviceProtocol.MQTT, "Advantech", "WISE-710",
                "Spinning hall, panel SP-2", "192.168.10.5", 1883, null, d -> {
                    d.setMqttTopic("rhr/plant1/+/telemetry");
                    d.setMqttClientId("rhr-intellicore-gw1");
                    d.setMqttQos(1);
                    d.setNotes("Edge gateway publishing JSON readings for all ring frames");
                }));
        list.add(device("RF-01 Siemens PLC", DeviceType.PLC, DeviceProtocol.MODBUS_TCP, "Siemens", "S7-1200 CPU 1214C",
                "Ring frame RF-01 headstock", "192.168.10.21", 502, ids.get("RF-01"), d -> {
                    d.setModbusUnitId(1);
                    d.setPollIntervalSec(5);
                    d.setRegisterMap(registerMap);
                }));
        list.add(device("CD-01 Delta PLC", DeviceType.PLC, DeviceProtocol.MODBUS_TCP, "Delta", "DVP-28SV",
                "Carding CD-01 control panel", "192.168.10.31", 502, ids.get("CD-01"), d -> {
                    d.setModbusUnitId(2);
                    d.setPollIntervalSec(10);
                    d.setRegisterMap(registerMap);
                }));
        list.add(device("SX-01 Operator HMI", DeviceType.HMI, DeviceProtocol.MODBUS_TCP, "Weintek", "cMT3072XH",
                "Simplex SX-01", "192.168.10.41", 502, ids.get("SX-01"), d -> {
                    d.setModbusUnitId(1);
                    d.setPollIntervalSec(5);
                    d.setRegisterMap(registerMap);
                }));
        list.add(device("Autoconer OPC UA Server", DeviceType.EDGE_PC, DeviceProtocol.OPC_UA, "Savio", "Polar I/M",
                "Winding section", "192.168.10.51", 4840, ids.get("AC-01"), d -> {
                    d.setOpcEndpointPath("/savio/polar");
                    d.setOpcNodeMap("{\"speed\":\"ns=2;s=AC01.Speed\",\"cvPercent\":\"ns=2;s=AC01.CV\"}");
                }));
        list.add(device("Humidity Sensor Hub", DeviceType.SENSOR, DeviceProtocol.HTTP_PUSH, "Honeywell", "HIH-8000 hub",
                "Humidification plant", null, null, null,
                d -> d.setApiKey("dev_" + UUID.randomUUID().toString().replace("-", ""))));
        deviceRepo.saveAll(list);
    }

    private DeviceConnection device(String name, DeviceType type, DeviceProtocol protocol, String make, String model,
                                    String location, String host, Integer port, Long machineId,
                                    Consumer<DeviceConnection> extra) {
        DeviceConnection d = new DeviceConnection();
        d.setName(name);
        d.setDeviceType(type);
        d.setProtocol(protocol);
        d.setMake(make);
        d.setModel(model);
        d.setLocation(location);
        d.setHost(host);
        d.setPort(port);
        d.setMachineId(machineId);
        d.setEnabled(false);
        d.setCreatedAt(shiftService.now());
        d.setUpdatedAt(d.getCreatedAt());
        extra.accept(d);
        return d;
    }

    /** A shared sample dashboard showing what the widget builder can do. */
    private void seedDashboard() {
        CustomDashboard d = new CustomDashboard();
        d.setOwner("admin");
        d.setName("Energy & Quality");
        d.setDescription("Sample dashboard built with the widget builder");
        d.setShared(true);
        d.setCreatedAt(shiftService.now());
        d.setUpdatedAt(d.getCreatedAt());
        d.setWidgets("""
                [
                 {"id":"w1","title":"Energy this month","type":"stat","size":1,
                  "query":{"dataset":"production","dimensions":[],"measures":[{"key":"energy_kwh","agg":"SUM"}],"filters":{"range":"THIS_MONTH"}}},
                 {"id":"w2","title":"OEE this month","type":"stat","size":1,
                  "query":{"dataset":"production","dimensions":[],"measures":[{"key":"oee"}],"filters":{"range":"THIS_MONTH"}}},
                 {"id":"w3","title":"Open alarms","type":"stat","size":1,
                  "query":{"dataset":"alarms","dimensions":[],"measures":[{"key":"open_alarms"}],"filters":{"range":"LAST_30_DAYS"}}},
                 {"id":"w4","title":"Energy by machine type","type":"bar","size":2,
                  "query":{"dataset":"production","dimensions":[{"key":"machine_type"}],"measures":[{"key":"energy_kwh","agg":"SUM"}],"filters":{"range":"THIS_MONTH"}}},
                 {"id":"w5","title":"Alarms by type","type":"pie","size":1,
                  "query":{"dataset":"alarms","dimensions":[{"key":"type"}],"measures":[{"key":"alarms"}],"filters":{"range":"LAST_30_DAYS"}}},
                 {"id":"w6","title":"Monthly production by shift","type":"line","size":3,
                  "query":{"dataset":"production","dimensions":[{"key":"date","grain":"month"},{"key":"shift"}],"measures":[{"key":"production_kg","agg":"SUM"}],"filters":{"range":"LAST_12_MONTHS"}}},
                 {"id":"w7","title":"Speed utilisation vs CV% by machine","type":"scatter","size":2,
                  "query":{"dataset":"production","dimensions":[{"key":"machine"}],"measures":[{"key":"speed_util","agg":"AVG"},{"key":"avg_cv","agg":"AVG"}],"filters":{"range":"LAST_30_DAYS"}}},
                 {"id":"w8","title":"Machine league table","type":"table","size":1,
                  "query":{"dataset":"production","dimensions":[{"key":"machine"}],"measures":[{"key":"oee"},{"key":"production_kg","agg":"SUM"}],"filters":{"range":"LAST_7_DAYS"},"limit":12}}
                ]""");
        dashboardRepo.save(d);
    }

    /** Shift summaries for every completed (and the current, partial) shift over the history window. */
    private void seedHistory(List<Machine> machines) {
        Random rnd = new Random(42);
        LocalDateTime now = shiftService.now();
        LocalDate today = shiftService.currentProductionDate();
        int days = props.seed().historyDays();
        List<Object[]> rows = new ArrayList<>();

        for (int d = days; d >= 0; d--) {
            LocalDate date = today.minusDays(d);
            double improvement = 0.03 * (days - d) / days;
            double monsoon = (date.getMonthValue() >= 6 && date.getMonthValue() <= 9) ? 6 : 0;
            for (ShiftWindow w : shiftService.windowsFor(date)) {
                if (!w.start().isBefore(now)) continue;
                long planned = Duration.between(w.start(), w.end()).toSeconds();
                long elapsed = w.end().isAfter(now) ? Duration.between(w.start(), now).toSeconds() : planned;
                for (Machine m : machines) {
                    double base = 0.86 + (m.getId() % 5) * 0.018 + improvement - ("C".equals(w.code()) ? 0.02 : 0);
                    double a = clamp(base + rnd.nextGaussian() * 0.035, 0.55, 0.985);
                    if (rnd.nextDouble() < 0.015) a = 0.25 + rnd.nextDouble() * 0.35; // maintenance / power cut
                    double p = clamp(0.88 + (m.getId() % 3) * 0.02 + improvement + rnd.nextGaussian() * 0.025, 0.7, 0.99);
                    double cvFactor = 0.95 + Math.abs(rnd.nextGaussian()) * 0.06;
                    double rejectPct = 0.006 + Math.max(0, cvFactor - 1) * 0.08 + rnd.nextDouble() * 0.006;

                    ShiftSummary s = new ShiftSummary();
                    s.setPlannedSec(planned);
                    s.setRunSec(Math.round(elapsed * a));
                    s.setDownSec(elapsed - s.getRunSec());
                    s.setProductionKg(m.getIdealRateKgPerHour() * s.getRunSec() / 3600.0 * p);
                    s.setRejectKg(s.getProductionKg() * rejectPct);
                    s.setSamples(s.getRunSec() / 5);
                    s.setSpeedSum(m.getRatedSpeed() * p * s.getSamples());
                    s.setCvSum(m.getTargetCv() * cvFactor * s.getSamples());
                    s.setTempSum((m.getMaxTemperature() - 7 + rnd.nextGaussian()) * s.getSamples());
                    s.setHumiditySum((54 + monsoon + rnd.nextGaussian() * 2) * s.getSamples());
                    s.setEnergyKwh(SimulatorService.ratedPowerKw(m.getType()) * (0.88 * s.getRunSec() + 0.06 * s.getDownSec()) / 3600.0);
                    s.setStoppages((int) (s.getDownSec() / 900) + rnd.nextInt(3));
                    s.setBreaks((int) (s.getRunSec() / 3600.0 * SimulatorService.breakRatePerHour(m.getType()) * (0.8 + rnd.nextDouble() * 0.4)));
                    s.recompute(m.getIdealRateKgPerHour());

                    rows.add(new Object[]{m.getId(), Date.valueOf(date), w.code(), s.getPlannedSec(), s.getRunSec(),
                            s.getDownSec(), s.getStoppages(), s.getBreaks(), s.getProductionKg(), s.getRejectKg(),
                            s.getTargetKg(), s.getEnergyKwh(), s.getSamples(), s.getSpeedSum(), s.getCvSum(),
                            s.getTempSum(), s.getHumiditySum(), s.getAvgSpeed(), s.getAvgCv(), s.getAvgTemperature(),
                            s.getAvgHumidity(), s.getAvailability(), s.getPerformance(), s.getQuality(), s.getOee(),
                            SimulatorService.operatorFor(w.code(), m.getId()), Timestamp.valueOf(w.end().isAfter(now) ? now : w.end())});
                }
            }
        }
        jdbc.batchUpdate("""
                insert into shift_summary (machine_id, shift_date, shift_code, planned_sec, run_sec, down_sec, stoppages,
                  breaks, production_kg, reject_kg, target_kg, energy_kwh, samples, speed_sum, cv_sum, temp_sum,
                  humidity_sum, avg_speed, avg_cv, avg_temperature, avg_humidity, availability, performance, quality,
                  oee, operator_name, updated_at)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", rows);
        log.info("Seeded {} shift summaries covering {} days", rows.size(), days);
    }

    /** One reading per minute for the last 36 hours so trend charts are populated immediately. */
    private void seedRecentReadings(List<Machine> machines) {
        Random rnd = new Random(7);
        LocalDateTime now = shiftService.now().withSecond(0).withNano(0);
        List<Object[]> rows = new ArrayList<>();
        for (Machine m : machines) {
            SimulatorService.SimState state = new SimulatorService.SimState();
            for (LocalDateTime ts = now.minusHours(36); ts.isBefore(now); ts = ts.plusMinutes(1)) {
                TelemetryRequest r = simulator.next(m, state, 60, ts, rnd);
                ShiftWindow w = shiftService.resolve(ts);
                rows.add(new Object[]{m.getId(), Timestamp.valueOf(ts), Date.valueOf(w.shiftDate()), w.code(),
                        r.status(), r.speed(), r.cvPercent(), r.temperature(), r.humidity(), r.powerKw(),
                        r.vibration(), r.productionKg(), r.breaks(), "SEED"});
            }
        }
        jdbc.batchUpdate("""
                insert into machine_reading (machine_id, ts, shift_date, shift_code, status, speed, cv_percent,
                  temperature, humidity, power_kw, vibration, production_kg, breaks, source)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", rows);
        log.info("Seeded {} telemetry readings", rows.size());
    }

    private void seedAlarms(List<Machine> machines) {
        Random rnd = new Random(11);
        LocalDateTime now = shiftService.now();
        String[][] kinds = {
                {"HIGH_TEMP", "WARNING", "Temperature above configured limit"},
                {"HIGH_CV", "WARNING", "CV% exceeds target by more than 15%"},
                {"FAULT", "CRITICAL", "Machine reported a fault and stopped"},
                {"VIBRATION", "WARNING", "Vibration above 7.1 mm/s"},
                {"OFFLINE", "WARNING", "No telemetry received from gateway"}};
        List<Object[]> rows = new ArrayList<>();
        for (int i = 0; i < 36; i++) {
            Machine m = machines.get(rnd.nextInt(machines.size()));
            String[] k = kinds[rnd.nextInt(kinds.length)];
            LocalDateTime ts = now.minusMinutes(20 + rnd.nextInt(7 * 24 * 60));
            boolean ack = ts.isBefore(now.minusDays(2)) || rnd.nextDouble() < 0.4;
            rows.add(new Object[]{m.getId(), m.getCode(), Timestamp.valueOf(ts), k[1], k[0], k[2], ack,
                    ack ? "supervisor" : null, ack ? Timestamp.valueOf(ts.plusMinutes(5 + rnd.nextInt(40))) : null});
        }
        jdbc.batchUpdate("""
                insert into alarm (machine_id, machine_code, ts, severity, type, message, acknowledged,
                  acknowledged_by, acknowledged_at) values (?,?,?,?,?,?,?,?,?)""", rows);
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
