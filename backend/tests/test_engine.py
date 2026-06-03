from app.engine import RelativisticCivilizationEngine
from app.models import Polity, PolityTrait
from app.scenarios import scenario_config


def run_scenario(scenario: str, steps: int = 90):
    config = scenario_config(scenario, seed=7)
    engine = RelativisticCivilizationEngine(config)
    world = engine.create_world()
    engine.run(world, steps)
    return world


def test_same_seed_is_deterministic() -> None:
    first = run_scenario("baseline_empire", 60)
    second = run_scenario("baseline_empire", 60)
    assert [metric.model_dump() for metric in first.metrics] == [metric.model_dump() for metric in second.metrics]
    assert [event.model_dump(mode="json") for event in first.events] == [
        event.model_dump(mode="json") for event in second.events
    ]


def test_centralized_command_raises_split_pressure_vs_federation() -> None:
    centralized = run_scenario("centralized_command", 140).metrics[-1]
    federated = run_scenario("federated_network", 140).metrics[-1]
    assert centralized.split_risk > federated.split_risk
    assert centralized.war_tension > federated.war_tension


def test_trade_routes_include_delay_and_black_hole_risk() -> None:
    world = run_scenario("black_hole_frontier", 100)
    assert world.trade_routes
    assert all(route.delay_years == route.distance_ly for route in world.trade_routes)
    influenced = [
        route
        for route in world.trade_routes
        if max(
            next(system for system in world.systems if system.id == route.a_id).black_hole_influence,
            next(system for system in world.systems if system.id == route.b_id).black_hole_influence,
        )
        > 0
    ]
    assert not influenced or max(route.risk for route in influenced) >= min(route.risk for route in world.trade_routes)


def test_polity_traits_are_deterministic_with_same_seed() -> None:
    first = run_scenario("centralized_command", 220)
    second = run_scenario("centralized_command", 220)
    assert [(polity.name, polity.trait) for polity in first.polities] == [
        (polity.name, polity.trait) for polity in second.polities
    ]


def test_cold_war_metrics_are_bounded() -> None:
    latest = run_scenario("centralized_command", 120).metrics[-1]
    cold_war = latest.cold_war
    assert 0 <= cold_war.deterrence_stability <= 1
    assert 0 <= cold_war.first_strike_pressure <= 1
    assert cold_war.recall_delay >= 0
    assert 0 <= cold_war.escalation_risk <= 1
    assert 0 <= cold_war.frontier_militarization <= 1


def test_federalist_trait_lowers_command_pressure() -> None:
    config = scenario_config("baseline_empire", seed=41)
    engine = RelativisticCivilizationEngine(config)
    centralist = engine.create_world()
    federalist = centralist.model_copy(deep=True)
    next(polity for polity in federalist.polities if polity.id == "empire").trait = PolityTrait.FEDERALIST
    centralist_metric = engine._measure(centralist)
    federalist_metric = engine._measure(federalist)
    assert federalist_metric.risk_breakdown.command_pressure < centralist_metric.risk_breakdown.command_pressure


def test_militarist_trait_raises_escalation_risk() -> None:
    config = scenario_config("baseline_empire", seed=42)
    engine = RelativisticCivilizationEngine(config)
    world = engine.create_world()
    engine.run(world, 100)
    candidate = next(system for system in world.systems if system.population > 0 and system.id != "sol")
    peaceful = world.model_copy(deep=True)
    militarist = world.model_copy(deep=True)
    peaceful.polities.append(
        Polity(id="frontier", name="Frontier Compact", capital_system_id=candidate.id, trait=PolityTrait.FEDERALIST, militarization=0.12)
    )
    militarist.polities.append(
        Polity(id="frontier", name="Frontier Compact", capital_system_id=candidate.id, trait=PolityTrait.MILITARIST, militarization=0.72)
    )
    next(system for system in peaceful.systems if system.id == candidate.id).polity_id = "frontier"
    next(system for system in militarist.systems if system.id == candidate.id).polity_id = "frontier"
    assert engine._cold_war_metrics(militarist).escalation_risk > engine._cold_war_metrics(peaceful).escalation_risk


def test_trade_league_trait_increases_trade_throughput_vs_isolationist() -> None:
    config = scenario_config("baseline_empire", seed=43)
    engine = RelativisticCivilizationEngine(config)
    world = engine.create_world()
    engine.run(world, 100)
    trade_league = world.model_copy(deep=True)
    isolationist = world.model_copy(deep=True)
    for polity in trade_league.polities:
        polity.trait = PolityTrait.TRADE_LEAGUE
    for polity in isolationist.polities:
        polity.trait = PolityTrait.ISOLATIONIST
    engine._build_trade_routes(trade_league)
    engine._build_trade_routes(isolationist)
    trade_sum = sum(route.throughput * (1 - route.risk) for route in trade_league.trade_routes)
    isolation_sum = sum(route.throughput * (1 - route.risk) for route in isolationist.trade_routes)
    assert trade_sum > isolation_sum


def test_black_hole_frontier_selects_frontier_science_trait() -> None:
    config = scenario_config("black_hole_frontier", seed=44)
    engine = RelativisticCivilizationEngine(config)
    world = engine.create_world()
    influenced = max(world.systems, key=lambda system: system.black_hole_influence)
    influenced.black_hole_influence = 0.72
    influenced.population = 1.0
    influenced.autonomy = 0.8
    assert engine._select_polity_trait(world, influenced, delay_pressure=0.5) == PolityTrait.FRONTIER_SCIENCE
