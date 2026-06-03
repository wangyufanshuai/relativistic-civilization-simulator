from app.physics import flight_duration_years, light_delay_years, lorentz_gamma, proper_time_years


def test_light_delay_matches_distance_in_ly() -> None:
    assert light_delay_years(12.5) == 12.5


def test_near_light_velocity_reduces_ship_proper_time() -> None:
    slow = proper_time_years(10, 0.3)
    fast = proper_time_years(10, 0.86)
    assert lorentz_gamma(0.86) > lorentz_gamma(0.3)
    assert flight_duration_years(10, 0.86) < flight_duration_years(10, 0.3)
    assert fast < slow

