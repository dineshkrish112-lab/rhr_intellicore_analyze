package com.rhr.intellicore.service.device;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ghgande.j2mod.modbus.procimg.Register;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Maps telemetry fields to Modbus holding registers, e.g.
 * {@code {"speed":{"address":0,"scale":1},"cvPercent":{"address":1,"scale":0.01},"status":{"address":7}}}.
 * Registers are read in one block from the lowest to the highest address.
 */
public final class RegisterMap {

    /** Fields a register can be mapped to; counters are cumulative in the PLC. */
    public static final Set<String> FIELDS = new LinkedHashSet<>(List.of(
            "status", "speed", "cvPercent", "temperature", "humidity", "powerKw", "vibration",
            "productionKg", "productionCounter", "rejectCounter", "breaksCounter"));

    private static final int MAX_BLOCK = 125; // Modbus limit for one read

    record Entry(int address, double scale, boolean signed) {}

    private final Map<String, Entry> entries;

    private RegisterMap(Map<String, Entry> entries) {
        this.entries = entries;
    }

    public static RegisterMap parse(ObjectMapper mapper, String json) {
        Map<String, Entry> m = new LinkedHashMap<>();
        if (json == null || json.isBlank()) return new RegisterMap(m);
        try {
            JsonNode root = mapper.readTree(json);
            root.fields().forEachRemaining(e -> {
                if (!FIELDS.contains(e.getKey())) {
                    throw new IllegalArgumentException("Unknown register field '" + e.getKey() + "'. Allowed: " + FIELDS);
                }
                JsonNode n = e.getValue();
                if (!n.has("address")) throw new IllegalArgumentException(e.getKey() + " needs an address");
                int addr = n.get("address").asInt();
                if (addr < 0 || addr > 65535) throw new IllegalArgumentException(e.getKey() + " address out of range");
                m.put(e.getKey(), new Entry(addr, n.path("scale").asDouble(1.0), n.path("signed").asBoolean(false)));
            });
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Register map must be valid JSON: " + e.getMessage());
        }
        RegisterMap map = new RegisterMap(m);
        if (!m.isEmpty() && map.count() > MAX_BLOCK) {
            throw new IllegalArgumentException("Mapped registers must fit in one block of " + MAX_BLOCK);
        }
        return map;
    }

    public boolean isEmpty() {
        return entries.isEmpty();
    }

    public int first() {
        return entries.values().stream().mapToInt(Entry::address).min().orElse(0);
    }

    public int count() {
        return entries.values().stream().mapToInt(Entry::address).max().orElse(0) - first() + 1;
    }

    public Map<String, Double> decode(Register[] regs) {
        Map<String, Double> out = new HashMap<>();
        int base = first();
        entries.forEach((field, e) -> {
            int i = e.address() - base;
            if (i < regs.length) {
                int raw = e.signed() ? regs[i].toShort() : regs[i].getValue();
                out.put(field, raw * e.scale());
            }
        });
        return out;
    }

    public String decodeForDisplay(Register[] regs) {
        return decode(regs).entrySet().stream().sorted(Map.Entry.comparingByKey())
                .map(e -> e.getKey() + "=" + Math.round(e.getValue() * 100) / 100.0)
                .collect(Collectors.joining(", "));
    }
}
