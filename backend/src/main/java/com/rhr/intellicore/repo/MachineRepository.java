package com.rhr.intellicore.repo;

import com.rhr.intellicore.domain.Machine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MachineRepository extends JpaRepository<Machine, Long> {
    Optional<Machine> findByCodeIgnoreCase(String code);

    List<Machine> findAllByOrderByCodeAsc();

    boolean existsByCodeIgnoreCase(String code);
}
