package com.rhr.intellicore.service.device;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ghgande.j2mod.modbus.facade.ModbusTCPMaster;
import com.ghgande.j2mod.modbus.procimg.Register;
import com.rhr.intellicore.domain.DeviceConnection;
import com.rhr.intellicore.domain.Enums.DeviceProtocol;
import com.rhr.intellicore.domain.Machine;
import com.rhr.intellicore.dto.Dtos.TelemetryRequest;
import com.rhr.intellicore.repo.DeviceConnectionRepository;
import com.rhr.intellicore.repo.MachineRepository;
import com.rhr.intellicore.service.ShiftService;
import com.rhr.intellicore.service.TelemetryService;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

/**
 * Runs one live connector per enabled device: an MQTT subscription, a Modbus TCP poller
 * (PLC / HMI registers) or a reachability probe (OPC UA). Everything decoded is fed into
 * {@link TelemetryService#ingest} exactly like the REST ingest endpoint.
 */
@Service
public class ConnectorManager {

    private static final Logger log = LoggerFactory.getLogger(ConnectorManager.class);
    private static final int CONNECT_TIMEOUT_MS = 4000;
    private static final long RETRY_SECONDS = 30;

    private final DeviceConnectionRepository deviceRepo;
    private final MachineRepository machineRepo;
    private final TelemetryService telemetry;
    private final ShiftService shiftService;
    private final ObjectMapper mapper;

    private final ScheduledExecutorService pool = Executors.newScheduledThreadPool(4, r -> {
        Thread t = new Thread(r, "device-connector");
        t.setDaemon(true);
        return t;
    });
    private final Map<Long, Connector> active = new ConcurrentHashMap<>();
    private final Map<Long, Runtime> runtime = new ConcurrentHashMap<>();

    /** Live connection state shown on the Devices page. */
    public static final class Runtime {
        volatile String state = "DISABLED";
        volatile String message = "Connector is switched off";
        volatile LocalDateTime lastConnectedAt;
        volatile LocalDateTime lastMessageAt;
        volatile long messages;
        volatile Long latencyMs;

        public Map<String, Object> view() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("state", state);
            m.put("message", message);
            m.put("lastConnectedAt", lastConnectedAt);
            m.put("lastMessageAt", lastMessageAt);
            m.put("messages", messages);
            m.put("latencyMs", latencyMs);
            return m;
        }
    }

    public record TestResult(boolean ok, String message, Long latencyMs) {}

    private interface Connector {
        void close();
    }

    public ConnectorManager(DeviceConnectionRepository deviceRepo, MachineRepository machineRepo,
                            TelemetryService telemetry, ShiftService shiftService, ObjectMapper mapper) {
        this.deviceRepo = deviceRepo;
        this.machineRepo = machineRepo;
        this.telemetry = telemetry;
        this.shiftService = shiftService;
        this.mapper = mapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void startAll() {
        // Give the live state a moment to load before devices start pushing readings.
        pool.schedule(() -> deviceRepo.findByEnabledTrue().forEach(this::apply), 3, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void shutdown() {
        active.values().forEach(Connector::close);
        pool.shutdownNow();
    }

    public Runtime runtime(Long deviceId) {
        return runtime.computeIfAbsent(deviceId, id -> new Runtime());
    }

    /** (Re)starts or stops the connector to match the device's saved configuration. */
    public synchronized void apply(DeviceConnection d) {
        stop(d.getId());
        Runtime rt = runtime(d.getId());
        if (!d.isEnabled()) {
            rt.state = "DISABLED";
            rt.message = "Connector is switched off";
            return;
        }
        switch (d.getProtocol()) {
            case MQTT -> active.put(d.getId(), new MqttConnector(d, rt));
            case MODBUS_TCP -> active.put(d.getId(), new ModbusPoller(d, rt));
            case OPC_UA -> active.put(d.getId(), new ReachabilityProbe(d, rt));
            case HTTP_PUSH -> {
                rt.state = rt.lastMessageAt == null ? "WAITING" : rt.state;
                rt.message = "Waiting for the device to POST to /api/iot/telemetry";
            }
        }
    }

    public synchronized void stop(Long deviceId) {
        Connector c = active.remove(deviceId);
        if (c != null) c.close();
    }

    /** Called by the REST ingest endpoint when a device authenticates with its own key. */
    public void recordPush(DeviceConnection d) {
        Runtime rt = runtime(d.getId());
        rt.lastMessageAt = shiftService.now();
        rt.messages++;
        rt.state = "RECEIVING";
        rt.message = "Receiving HTTP readings";
    }

    // ---------------------------------------------------------------- testing

    public TestResult test(DeviceConnection d) {
        if (d.getProtocol() == DeviceProtocol.HTTP_PUSH) {
            return new TestResult(true, "Push devices connect to us: POST /api/iot/telemetry with header X-Device-Key", null);
        }
        if (d.getHost() == null || d.getHost().isBlank() || d.getPort() == null) {
            return new TestResult(false, "Host and port are required", null);
        }
        return switch (d.getProtocol()) {
            case MQTT -> testMqtt(d);
            case MODBUS_TCP -> testModbus(d);
            default -> probe(d.getHost(), d.getPort());
        };
    }

    private TestResult testMqtt(DeviceConnection d) {
        long t0 = System.nanoTime();
        MqttClient client = null;
        try {
            client = new MqttClient(brokerUri(d), "rhr-test-" + UUID.randomUUID().toString().substring(0, 8), new MemoryPersistence());
            MqttConnectOptions o = options(d);
            o.setAutomaticReconnect(false);
            o.setConnectionTimeout(CONNECT_TIMEOUT_MS / 1000);
            client.connect(o);
            long ms = (System.nanoTime() - t0) / 1_000_000;
            return new TestResult(true, "Broker accepted the connection" + (d.getMqttTopic() != null ? "; will subscribe to " + d.getMqttTopic() : ""), ms);
        } catch (MqttException e) {
            return new TestResult(false, "MQTT: " + describe(e), null);
        } finally {
            closeQuietly(client);
        }
    }

    private TestResult testModbus(DeviceConnection d) {
        long t0 = System.nanoTime();
        ModbusTCPMaster master = new ModbusTCPMaster(d.getHost(), d.getPort(), CONNECT_TIMEOUT_MS, false);
        try {
            master.connect();
            RegisterMap map = RegisterMap.parse(mapper, d.getRegisterMap());
            if (map.isEmpty()) {
                return new TestResult(true, "TCP connection to the PLC succeeded (no register map configured yet)",
                        (System.nanoTime() - t0) / 1_000_000);
            }
            Register[] regs = master.readMultipleRegisters(unit(d), map.first(), map.count());
            long ms = (System.nanoTime() - t0) / 1_000_000;
            return new TestResult(true, "Read " + regs.length + " holding registers from " + map.first() + ": "
                    + map.decodeForDisplay(regs), ms);
        } catch (Exception e) {
            return new TestResult(false, "Modbus: " + rootMessage(e), null);
        } finally {
            master.disconnect();
        }
    }

    private static TestResult probe(String host, int port) {
        long t0 = System.nanoTime();
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
            return new TestResult(true, "Port " + port + " is reachable on " + host, (System.nanoTime() - t0) / 1_000_000);
        } catch (Exception e) {
            return new TestResult(false, "Cannot reach " + host + ":" + port + " (" + rootMessage(e) + ")", null);
        }
    }

    // ------------------------------------------------------------- connectors

    private final class MqttConnector implements Connector {
        private final DeviceConnection d;
        private final Runtime rt;
        private volatile MqttClient client;
        private volatile boolean closed;
        private volatile ScheduledFuture<?> retry;

        MqttConnector(DeviceConnection d, Runtime rt) {
            this.d = d;
            this.rt = rt;
            pool.execute(this::connect);
        }

        private void connect() {
            if (closed) return;
            rt.state = "CONNECTING";
            rt.message = "Connecting to " + brokerUri(d);
            try {
                String clientId = d.getMqttClientId() != null && !d.getMqttClientId().isBlank()
                        ? d.getMqttClientId() : "rhr-intellicore-" + d.getId();
                MqttClient c = new MqttClient(brokerUri(d), clientId, new MemoryPersistence());
                c.setCallback(new MqttCallbackExtended() {
                    @Override
                    public void connectComplete(boolean reconnect, String uri) {
                        try {
                            c.subscribe(topic(), qos());
                            rt.state = "CONNECTED";
                            rt.message = "Subscribed to " + topic();
                            rt.lastConnectedAt = shiftService.now();
                        } catch (MqttException e) {
                            rt.state = "ERROR";
                            rt.message = "Subscribe failed: " + describe(e);
                        }
                    }

                    @Override
                    public void connectionLost(Throwable cause) {
                        rt.state = "RECONNECTING";
                        rt.message = "Connection lost: " + rootMessage(cause);
                    }

                    @Override
                    public void messageArrived(String topic, MqttMessage message) {
                        onMessage(topic, message.getPayload());
                    }

                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {
                    }
                });
                c.connect(options(d));
                client = c;
                if (closed) closeQuietly(c);
            } catch (MqttException e) {
                rt.state = "ERROR";
                rt.message = describe(e) + " - retrying in " + RETRY_SECONDS + "s";
                if (!closed) retry = pool.schedule(this::connect, RETRY_SECONDS, TimeUnit.SECONDS);
            }
        }

        private void onMessage(String topic, byte[] payload) {
            try {
                JsonNode node = mapper.readTree(new String(payload, StandardCharsets.UTF_8));
                List<JsonNode> items = new ArrayList<>();
                if (node.isArray()) node.forEach(items::add);
                else items.add(node);
                for (JsonNode n : items) {
                    if (!n.isObject()) continue;
                    ObjectNode o = (ObjectNode) n;
                    if (!o.hasNonNull("machineCode")) {
                        String code = machineCode(d);
                        if (code == null) throw new IllegalArgumentException("payload has no machineCode and device is not mapped to a machine");
                        o.put("machineCode", code);
                    }
                    telemetry.ingest(mapper.treeToValue(o, TelemetryRequest.class), TelemetryService.SOURCE_DEVICE);
                    rt.messages++;
                }
                rt.lastMessageAt = shiftService.now();
            } catch (Exception e) {
                rt.message = "Last message on " + topic + " rejected: " + rootMessage(e);
            }
        }

        private String topic() {
            return d.getMqttTopic() == null || d.getMqttTopic().isBlank() ? "rhr/+/telemetry" : d.getMqttTopic();
        }

        private int qos() {
            return d.getMqttQos() == null ? 1 : Math.max(0, Math.min(2, d.getMqttQos()));
        }

        @Override
        public void close() {
            closed = true;
            if (retry != null) retry.cancel(false);
            closeQuietly(client);
        }
    }

    /** Polls holding registers from a PLC / HMI over Modbus TCP and converts them to a reading. */
    private final class ModbusPoller implements Connector {
        private final DeviceConnection d;
        private final Runtime rt;
        private final RegisterMap map;
        private final ScheduledFuture<?> task;
        private ModbusTCPMaster master;
        private Double lastProduction;
        private Double lastReject;
        private Double lastBreaks;

        ModbusPoller(DeviceConnection d, Runtime rt) {
            this.d = d;
            this.rt = rt;
            this.map = RegisterMap.parse(mapper, d.getRegisterMap());
            int interval = d.getPollIntervalSec() == null ? 5 : Math.max(1, d.getPollIntervalSec());
            rt.state = "CONNECTING";
            rt.message = "Polling " + d.getHost() + ":" + d.getPort() + " every " + interval + "s";
            this.task = pool.scheduleWithFixedDelay(this::poll, 0, interval, TimeUnit.SECONDS);
        }

        private void poll() {
            try {
                String code = machineCode(d);
                if (code == null) throw new IllegalStateException("map this PLC to a machine first");
                if (map.isEmpty()) throw new IllegalStateException("register map is empty");
                if (master == null) {
                    master = new ModbusTCPMaster(d.getHost(), d.getPort(), CONNECT_TIMEOUT_MS, true);
                    master.connect();
                    rt.lastConnectedAt = shiftService.now();
                }
                Register[] regs = master.readMultipleRegisters(unit(d), map.first(), map.count());
                Map<String, Double> v = map.decode(regs);

                Double production = delta(v.get("productionCounter"), lastProduction);
                Double reject = delta(v.get("rejectCounter"), lastReject);
                Double breaks = delta(v.get("breaksCounter"), lastBreaks);
                lastProduction = v.get("productionCounter");
                lastReject = v.get("rejectCounter");
                lastBreaks = v.get("breaksCounter");

                telemetry.ingest(new TelemetryRequest(code, null, statusName(v.get("status")), v.get("speed"),
                        v.get("cvPercent"), v.get("temperature"), v.get("humidity"), v.get("powerKw"), v.get("vibration"),
                        production != null ? production : v.get("productionKg"), reject,
                        breaks == null ? null : breaks.intValue(), null), TelemetryService.SOURCE_DEVICE);
                rt.state = "CONNECTED";
                rt.message = "Reading " + map.count() + " registers from unit " + unit(d);
                rt.lastMessageAt = shiftService.now();
                rt.messages++;
            } catch (Exception e) {
                rt.state = "ERROR";
                rt.message = rootMessage(e);
                if (master != null) {
                    master.disconnect();
                    master = null;
                }
            }
        }

        /** Counters are cumulative in the PLC; a reset (value going down) counts as zero. */
        private Double delta(Double now, Double prev) {
            if (now == null) return null;
            if (prev == null || now < prev) return 0.0;
            return now - prev;
        }

        @Override
        public void close() {
            task.cancel(true);
            if (master != null) master.disconnect();
        }
    }

    /** OPC UA servers are probed for reachability; values are collected through an edge gateway. */
    private final class ReachabilityProbe implements Connector {
        private final ScheduledFuture<?> task;

        ReachabilityProbe(DeviceConnection d, Runtime rt) {
            task = pool.scheduleWithFixedDelay(() -> {
                TestResult r = probe(d.getHost(), d.getPort() == null ? 4840 : d.getPort());
                rt.state = r.ok() ? "REACHABLE" : "UNREACHABLE";
                rt.message = r.ok() ? "Endpoint reachable; collect values via an MQTT/HTTP edge gateway" : r.message();
                rt.latencyMs = r.latencyMs();
                if (r.ok()) rt.lastConnectedAt = shiftService.now();
            }, 0, RETRY_SECONDS, TimeUnit.SECONDS);
        }

        @Override
        public void close() {
            task.cancel(true);
        }
    }

    // ---------------------------------------------------------------- helpers

    private String machineCode(DeviceConnection d) {
        return d.getMachineId() == null ? null : machineRepo.findById(d.getMachineId()).map(Machine::getCode).orElse(null);
    }

    private static String statusName(Double code) {
        if (code == null) return null;
        return switch (code.intValue()) {
            case 1 -> "RUNNING";
            case 2 -> "IDLE";
            case 3 -> "FAULT";
            default -> "STOPPED";
        };
    }

    private static int unit(DeviceConnection d) {
        return d.getModbusUnitId() == null ? 1 : d.getModbusUnitId();
    }

    private static String brokerUri(DeviceConnection d) {
        return (d.isUseTls() ? "ssl://" : "tcp://") + d.getHost() + ":" + (d.getPort() == null ? 1883 : d.getPort());
    }

    private static MqttConnectOptions options(DeviceConnection d) {
        MqttConnectOptions o = new MqttConnectOptions();
        o.setAutomaticReconnect(true);
        o.setCleanSession(true);
        o.setConnectionTimeout(10);
        o.setKeepAliveInterval(30);
        if (d.getUsername() != null && !d.getUsername().isBlank()) {
            o.setUserName(d.getUsername());
            if (d.getPassword() != null) o.setPassword(d.getPassword().toCharArray());
        }
        return o;
    }

    private static void closeQuietly(MqttClient c) {
        if (c == null) return;
        try {
            if (c.isConnected()) c.disconnect(1000);
            c.close();
        } catch (MqttException ignored) {
            // already closed
        }
    }

    private static String describe(MqttException e) {
        return switch (e.getReasonCode()) {
            case MqttException.REASON_CODE_FAILED_AUTHENTICATION, MqttException.REASON_CODE_NOT_AUTHORIZED -> "broker rejected the username / password";
            case MqttException.REASON_CODE_SERVER_CONNECT_ERROR -> "cannot reach the broker (" + rootMessage(e) + ")";
            case MqttException.REASON_CODE_CLIENT_TIMEOUT -> "broker did not answer in time";
            default -> rootMessage(e);
        };
    }

    static String rootMessage(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null && c.getCause() != c) c = c.getCause();
        String m = c.getMessage();
        return m == null || m.isBlank() ? c.getClass().getSimpleName() : m;
    }

    /** HTTP push devices have no connection to watch, so flag them when they go quiet. */
    @Scheduled(fixedDelay = 15000, initialDelay = 20000)
    public void watchPushDevices() {
        LocalDateTime now = shiftService.now();
        for (DeviceConnection d : deviceRepo.findByEnabledTrue()) {
            if (d.getProtocol() != DeviceProtocol.HTTP_PUSH) continue;
            Runtime rt = runtime(d.getId());
            if (rt.lastMessageAt != null && Duration.between(rt.lastMessageAt, now).toSeconds() > 60) {
                rt.state = "SILENT";
                rt.message = "No HTTP reading for over a minute";
            }
        }
    }
}
