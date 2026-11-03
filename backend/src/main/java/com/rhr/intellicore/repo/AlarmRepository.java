package com.rhr.intellicore.repo;

import com.rhr.intellicore.domain.Alarm;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

public interface AlarmRepository extends JpaRepository<Alarm, Long> {
    Page<Alarm> findByAcknowledgedFalseOrderByTsDesc(Pageable pageable);

    Page<Alarm> findAllByOrderByTsDesc(Pageable pageable);

    long countByAcknowledgedFalse();

    @Modifying
    @Transactional
    @Query("update Alarm a set a.acknowledged = true, a.acknowledgedBy = :by, a.acknowledgedAt = :at where a.acknowledged = false")
    int acknowledgeAll(String by, LocalDateTime at);
}
