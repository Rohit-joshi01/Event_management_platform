package com.aftr.exception;

import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;

/** Uniform error body returned by every failing endpoint. */
public record ErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String code,
        String message,
        String path,
        List<FieldError> fieldErrors) {

    public record FieldError(String field, String message) {
    }

    public static ErrorResponse of(HttpStatus status, String message, String path) {
        return new ErrorResponse(Instant.now(), status.value(), status.getReasonPhrase(), status.name(), message, path, List.of());
    }

    public static ErrorResponse of(HttpStatus status, String code, String message, String path, List<FieldError> fieldErrors) {
        return new ErrorResponse(Instant.now(), status.value(), status.getReasonPhrase(), code, message, path, fieldErrors);
    }
}
