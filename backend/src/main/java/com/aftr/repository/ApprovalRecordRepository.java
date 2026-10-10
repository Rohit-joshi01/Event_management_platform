package com.aftr.repository;

import com.aftr.entity.ApprovalRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalRecordRepository extends JpaRepository<ApprovalRecord, Long> {

    @EntityGraph(attributePaths = {"event", "admin"})
    Page<ApprovalRecord> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"admin"})
    List<ApprovalRecord> findByEventIdOrderByCreatedAtDesc(Long eventId);
}
