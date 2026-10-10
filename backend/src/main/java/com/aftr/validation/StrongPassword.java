package com.aftr.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/** At least 8 characters, containing at least one letter and one digit. */
@Documented
@Constraint(validatedBy = StrongPasswordValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {
    String message() default "Use at least 8 characters with at least one letter and one number.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
