package com.aftr.validation;

import java.time.Instant;

/** Implemented by requests that carry a start/end pair validated by {@link ValidTimeRange}. */
public interface TimeRange {
    Instant rangeStart();

    Instant rangeEnd();
}
