package com.rhr.intellicore.repo;

import com.rhr.intellicore.domain.CustomDashboard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomDashboardRepository extends JpaRepository<CustomDashboard, Long> {
    List<CustomDashboard> findByOwnerIgnoreCaseOrSharedTrueOrderByPositionAscIdAsc(String owner);
}
