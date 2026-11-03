package com.rhr.intellicore.repo;

import com.rhr.intellicore.domain.ShiftSummary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ShiftSummaryRepository extends JpaRepository<ShiftSummary, Long> {
    Optional<ShiftSummary> findByMachineIdAndShiftDateAndShiftCode(Long machineId, LocalDate shiftDate, String shiftCode);

    List<ShiftSummary> findByShiftDate(LocalDate shiftDate);

    List<ShiftSummary> findByShiftDateBetween(LocalDate from, LocalDate to);

    List<ShiftSummary> findByMachineIdAndShiftDateOrderByShiftCodeAsc(Long machineId, LocalDate shiftDate);
}
