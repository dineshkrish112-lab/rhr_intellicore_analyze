package com.rhr.intellicore.domain;

/** Holder for small domain enums so they live next to the entities that use them. */
public final class Enums {
    private Enums() {}

    public enum Role { ADMIN, SUPERVISOR, OPERATOR }

    public enum MachineStatus { RUNNING, IDLE, STOPPED, FAULT, OFFLINE }

    public enum AlarmSeverity { CRITICAL, WARNING, INFO }

    /** How the platform talks to the device. */
    public enum DeviceProtocol { MQTT, MODBUS_TCP, OPC_UA, HTTP_PUSH }

    /** What the device physically is; used for grouping and icons. */
    public enum DeviceType { PLC, HMI, IOT_GATEWAY, EDGE_PC, SENSOR }
}
