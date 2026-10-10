package com.aftr.unit;

import com.aftr.validation.StrongPasswordValidator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StrongPasswordValidatorTest {

    private final StrongPasswordValidator validator = new StrongPasswordValidator();

    @Test
    void acceptsLettersAndDigitsOfSufficientLength() {
        assertThat(validator.isValid("Secur3pass", null)).isTrue();
    }

    @Test
    void rejectsWeakPasswords() {
        assertThat(validator.isValid("short1", null)).isFalse();
        assertThat(validator.isValid("allletters", null)).isFalse();
        assertThat(validator.isValid("1234567890", null)).isFalse();
        assertThat(validator.isValid("a1".repeat(40), null)).isFalse(); // > 72 bytes for BCrypt
    }
}
