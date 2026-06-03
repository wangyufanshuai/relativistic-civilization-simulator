from __future__ import annotations

from app.models import Scenario, SimulationConfig


SCENARIOS: list[Scenario] = [
    Scenario(
        id="baseline_empire",
        name="Baseline Empire",
        description="A single origin civilization expands into a medium-density star network.",
        overrides={},
    ),
    Scenario(
        id="slow_ships",
        name="Slow Ships",
        description="Lower ship velocity slows expansion and reduces shock between capital time and colony time.",
        overrides={"ship_velocity_c": 0.22, "expansion_pressure": 0.32, "centralization": 0.52},
    ),
    Scenario(
        id="near_light_migration",
        name="Near-Light Migration",
        description="Near-light ships create strong time dilation and ethical drift between migrants and home worlds.",
        overrides={"ship_velocity_c": 0.86, "expansion_pressure": 0.55, "centralization": 0.55},
    ),
    Scenario(
        id="centralized_command",
        name="Centralized Command",
        description="A high-command empire tries to govern frontier colonies through delayed directives.",
        overrides={"centralization": 0.86, "expansion_pressure": 0.48},
    ),
    Scenario(
        id="federated_network",
        name="Federated Network",
        description="Weak central control but higher autonomy tolerance lowers long-term fracture risk.",
        overrides={"centralization": 0.32, "federation_bias": 0.72, "expansion_pressure": 0.42},
    ),
    Scenario(
        id="black_hole_frontier",
        name="Black Hole Frontier",
        description="A research-rich but noisy black-hole frontier encourages special political development.",
        overrides={"black_hole_frontier": True, "expansion_pressure": 0.5, "ship_velocity_c": 0.52},
    ),
]


def scenario_config(scenario_id: str, seed: int | None = None) -> SimulationConfig:
    scenario = next((item for item in SCENARIOS if item.id == scenario_id), SCENARIOS[0])
    values = {"scenario": scenario.id, **scenario.overrides}
    if seed is not None:
        values["seed"] = seed
    return SimulationConfig(**values)

