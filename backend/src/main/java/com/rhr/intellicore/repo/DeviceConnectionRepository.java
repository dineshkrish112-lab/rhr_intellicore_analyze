package com.rhr.intellicore.repo;

import com.rhr.intellicore.domain.DeviceConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceConnectionRepository extends JpaRepository<DeviceConnection, Long> {
    List<DeviceConnection> findAllByOrderByNameAsc();

    List<DeviceConnection> findByEnabledTrue();

    Optional<DeviceConnection> findByApiKey(String apiKey);
}
