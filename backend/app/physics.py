from __future__ import annotations

from math import ceil, sqrt


LIGHT_SPEED_LY_PER_YEAR = 1.0


def light_delay_years(distance_ly: float) -> float:
    return max(0.0, distance_ly / LIGHT_SPEED_LY_PER_YEAR)


def lorentz_gamma(velocity_c: float) -> float:
    v = min(0.999_999, max(0.0, velocity_c))
    return 1.0 / sqrt(1.0 - v * v)


def flight_duration_years(distance_ly: float, velocity_c: float) -> int:
    return max(1, ceil(distance_ly / max(0.001, velocity_c)))


def proper_time_years(distance_ly: float, velocity_c: float) -> float:
    external = distance_ly / max(0.001, velocity_c)
    return external / lorentz_gamma(velocity_c)

