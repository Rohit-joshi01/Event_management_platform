package com.aftr.repository;

import com.aftr.entity.ScheduleItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleItemRepository extends JpaRepository<ScheduleItem, Long> {
}
