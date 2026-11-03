package com.rhr.intellicore.repo;

import com.rhr.intellicore.domain.MachineReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MachineReadingRepository extends JpaRepository<MachineReading, Long> {
    List<MachineReading> findByMachineIdAndTsAfterOrderByTsAsc(Long machineId, LocalDateTime after);

    Optional<MachineReading> findTopByMachineIdOrderByTsDesc(Long machineId);

    @Modifying
    @Transactional
    @Query("delete from MachineReading r where r.ts < :before")
    int deleteOlderThan(LocalDateTime before);
}
