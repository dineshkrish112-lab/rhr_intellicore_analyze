package com.rhr.intellicore.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String timezone,
        List<String> corsOrigins,
        Jwt jwt,
        Auth auth,
        Iot iot,
        Simulator simulator,
        Seed seed) {

    public record Jwt(String secret, int expiryHours) {}

    public record Auth(String staticOtp) {}

    public record Iot(String deviceKey, int offlineAfterSeconds, int readingRetentionDays) {}

    public record Simulator(boolean enabled, long intervalMs) {}

    public record Seed(int historyDays) {}
}
