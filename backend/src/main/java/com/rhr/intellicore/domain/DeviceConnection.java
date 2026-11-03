package com.rhr.intellicore.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.rhr.intellicore.domain.Enums.DeviceProtocol;
import com.rhr.intellicore.domain.Enums.DeviceType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A field device (PLC, HMI, IoT gateway ...) and how to reach it. Protocol-specific settings
 * live side by side; only the ones for the chosen protocol are used.
 */
@Entity
@Table(name = "device_connection")
@Getter
@Setter
public class DeviceConnection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DeviceType deviceType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DeviceProtocol protocol;

    private String make;
    private String model;
    private String location;
    private String notes;

    /** IP address or host name (broker host for MQTT). */
    private String host;
    private Integer port;

    /** Machine this device reports for; MQTT payloads may name the machine themselves instead. */
    private Long machineId;

    private boolean enabled;

    // --- MQTT ---
    private String mqttTopic;
    private String mqttClientId;
    private Integer mqttQos;
    private boolean useTls;

    // --- Credentials (MQTT broker / OPC UA) ---
    private String username;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    // --- Modbus TCP (PLC / HMI) ---
    private Integer modbusUnitId;
    private Integer pollIntervalSec;
    /** JSON: {"speed":{"address":0,"scale":1}, "status":{"address":7}, ...} */
    @Column(columnDefinition = "TEXT")
    private String registerMap;

    // --- OPC UA ---
    private String opcEndpointPath;
    /** JSON: {"speed":"ns=2;s=RF01.Speed", ...} */
    @Column(columnDefinition = "TEXT")
    private String opcNodeMap;

    // --- HTTP push ---
    /** Per-device key accepted on /api/iot/telemetry instead of the shared key. */
    @Column(length = 64)
    private String apiKey;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
