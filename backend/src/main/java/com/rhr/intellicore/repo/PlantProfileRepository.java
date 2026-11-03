package com.rhr.intellicore.repo;

import com.rhr.intellicore.domain.PlantProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlantProfileRepository extends JpaRepository<PlantProfile, Long> {
    Optional<PlantProfile> findFirstByOrderByIdAsc();
}
