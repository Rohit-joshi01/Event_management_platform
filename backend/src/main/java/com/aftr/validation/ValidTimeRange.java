package com.aftr.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/** Class-level constraint: when both ends are present, the end must be after the start. */
@Documented
@Constraint(validatedBy = ValidTimeRangeValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidTimeRange {
    String message() default "The end time must be after the start time.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
