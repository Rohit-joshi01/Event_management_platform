package com.aftr.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidTimeRangeValidator implements ConstraintValidator<ValidTimeRange, TimeRange> {

    @Override
    public boolean isValid(TimeRange value, ConstraintValidatorContext context) {
        if (value == null || value.rangeStart() == null || value.rangeEnd() == null) {
            return true;
        }
        return value.rangeEnd().isAfter(value.rangeStart());
    }
}
