package com.aftr.service;

import com.aftr.entity.AuditLog;
import com.aftr.repository.AuditLogRepository;
import com.aftr.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Writes the append-only audit trail. Runs inside the caller's transaction so a rolled-back action leaves no log. */
@Service
public class AuditService {

    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuthUser actor, String action, String entityType, Long entityId, String summary) {
        record(actor == null ? null : actor.getId(), actor == null ? null : actor.getEmail(), action, entityType, entityId, summary);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Long actorId, String actorEmail, String action, String entityType, Long entityId, String summary) {
        AuditLog log = new AuditLog();
        log.setActorId(actorId);
        log.setActorEmail(actorEmail);
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setSummary(summary.length() > 500 ? summary.substring(0, 497) + "..." : summary);
        log.setIpAddress(currentIp());
        repository.save(log);
    }

    private String currentIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest req = attrs.getRequest();
            return req.getRemoteAddr();
        }
        return null;
    }
}
