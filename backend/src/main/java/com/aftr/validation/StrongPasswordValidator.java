package com.aftr.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true; // @NotBlank handles presence
        }
        if (value.length() < 8 || value.length() > 72) {
            return false; // BCrypt only uses the first 72 bytes
        }
        boolean letter = value.chars().anyMatch(Character::isLetter);
        boolean digit = value.chars().anyMatch(Character::isDigit);
        return letter && digit;
    }
}
