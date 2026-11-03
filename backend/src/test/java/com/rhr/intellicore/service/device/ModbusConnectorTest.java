package com.rhr.intellicore.service.device;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ghgande.j2mod.modbus.procimg.SimpleProcessImage;
import com.ghgande.j2mod.modbus.procimg.SimpleRegister;
import com.ghgande.j2mod.modbus.slave.ModbusSlave;
import com.ghgande.j2mod.modbus.slave.ModbusSlaveFactory;
import com.rhr.intellicore.domain.DeviceConnection;
import com.rhr.intellicore.domain.Enums.DeviceProtocol;
import com.rhr.intellicore.domain.Enums.DeviceType;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Talks to a real in-process Modbus TCP slave to check register reads and scaling. */
class ModbusConnectorTest {

    private static final int PORT = 15502;
    private static ModbusSlave slave;
    private final ConnectorManager manager = new ConnectorManager(null, null, null, null, new ObjectMapper());

    @BeforeAll
    static void startSlave() throws Exception {
        SimpleProcessImage image = new SimpleProcessImage(1);
        int[] values = {1, 18250, 1142, 335, 562, 295, 28, 12345, 7};
        for (int v : values) image.addRegister(new SimpleRegister(v));
        slave = ModbusSlaveFactory.createTCPSlave(PORT, 2);
        slave.addProcessImage(1, image);
        slave.open();
    }

    @AfterAll
    static void stopSlave() {
        ModbusSlaveFactory.close(slave);
    }

    private DeviceConnection plc(String map) {
        DeviceConnection d = new DeviceConnection();
        d.setName("test plc");
        d.setDeviceType(DeviceType.PLC);
        d.setProtocol(DeviceProtocol.MODBUS_TCP);
        d.setHost("127.0.0.1");
        d.setPort(PORT);
        d.setModbusUnitId(1);
        d.setRegisterMap(map);
        return d;
    }

    @Test
    void readsAndScalesMappedRegisters() {
        var result = manager.test(plc("""
                {"status":{"address":0},"speed":{"address":1},"cvPercent":{"address":2,"scale":0.01},
                 "temperature":{"address":3,"scale":0.1}}"""));
        assertThat(result.ok()).as(result.message()).isTrue();
        assertThat(result.message()).contains("cvPercent=11.42", "speed=18250.0", "temperature=33.5", "status=1.0");
    }

    @Test
    void reportsUnreachablePlc() {
        DeviceConnection d = plc("{\"speed\":{\"address\":1}}");
        d.setPort(15599);
        var result = manager.test(d);
        assertThat(result.ok()).isFalse();
        assertThat(result.message()).startsWith("Modbus:");
    }

    @Test
    void rejectsUnknownRegisterField() {
        assertThatThrownBy(() -> RegisterMap.parse(new ObjectMapper(), "{\"rpm\":{\"address\":1}}"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown register field");
    }
}
