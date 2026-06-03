from __future__ import annotations

import random
from itertools import combinations
from statistics import mean

from app.models import (
    BlackHoleZone,
    ColdWarMetrics,
    Civilization,
    Event,
    EventType,
    Fleet,
    Message,
    Polity,
    PolityTrait,
    RelativisticMetrics,
    RiskBreakdown,
    SimulationConfig,
    StarSystem,
    TradeRoute,
    Vec3,
    WarState,
    WorldState,
)
from app.physics import flight_duration_years, light_delay_years, proper_time_years


STAR_NAMES = [
    "Sol",
    "Asterion",
    "Luyten",
    "Kepler",
    "Tau Ceti",
    "Vega",
    "Epsilon",
    "Icarus",
    "Khepri",
    "Naraka",
    "Pallas",
    "Qinling",
    "Rhea",
    "Sagan",
    "Tianhe",
    "Umbra",
]


class RelativisticCivilizationEngine:
    def __init__(self, config: SimulationConfig) -> None:
        self.config = config
        self.rng = random.Random(config.seed)

    def create_world(self) -> WorldState:
        systems = self._generate_star_network()
        systems[0].id = "sol"
        systems[0].name = "Sol"
        systems[0].position = Vec3(x=0, y=0, z=0)
        systems[0].population = 9.4
        systems[0].resources = 120.0
        systems[0].industry = 1.0
        systems[0].technology = 0.32
        systems[0].colonized_year = 0

        black_hole = BlackHoleZone(position=Vec3(x=32.0, y=-16.0, z=5.0)) if self.config.black_hole_frontier else None
        if black_hole:
            for system in systems:
                distance = system.position.distance_to(black_hole.position)
                system.black_hole_influence = max(0.0, 1.0 - distance / black_hole.radius_ly)

        empire = Polity(
            id="empire",
            name="Sol Mandate",
            capital_system_id="sol",
            trait=PolityTrait.CENTRALIST,
            centralization=self.config.centralization,
            autonomy_tolerance=min(0.85, 0.30 + (1.0 - self.config.centralization) * 0.28 + self.config.federation_bias * 0.42),
            trade_openness=0.52 + self.config.federation_bias * 0.22,
            militarization=0.25 + self.config.centralization * 0.22,
            color="#38bdf8",
        )
        world = WorldState(
            config=self.config,
            civilization=Civilization(),
            systems=systems,
            polities=[empire],
            black_hole=black_hole,
        )
        self._build_trade_routes(world)
        world.metrics.append(self._measure(world))
        return world

    def step(self, world: WorldState) -> WorldState:
        for _ in range(world.config.years_per_step):
            world.year += 1
            world.events = []
            self._deliver_messages(world)
            self._arrive_fleets(world)
            self._grow_systems(world)
            self._send_directives(world)
            self._launch_colony_fleets(world)
            self._trade_and_diffuse(world)
            self._update_politics(world)
            self._update_war_tension(world)
            self._build_trade_routes(world)
            world.metrics.append(self._measure(world))
        return world

    def run(self, world: WorldState, steps: int) -> WorldState:
        for _ in range(steps):
            self.step(world)
        return world

    def _generate_star_network(self) -> list[StarSystem]:
        systems = []
        for i in range(self.config.star_count):
            radius = self.rng.uniform(2, 44) * (0.35 + self.rng.random())
            systems.append(
                StarSystem(
                    id=f"sys_{i:03d}",
                    name=f"{STAR_NAMES[i % len(STAR_NAMES)]}-{i:02d}",
                    position=Vec3(
                        x=self.rng.uniform(-1, 1) * radius,
                        y=self.rng.uniform(-1, 1) * radius,
                        z=self.rng.uniform(-0.35, 0.35) * radius,
                    ),
                    resources=self.rng.uniform(24, 92),
                    industry=self.rng.uniform(0.04, 0.18),
                    technology=self.rng.uniform(0.05, 0.16),
                    loyalty=self.rng.uniform(0.68, 0.92),
                )
            )
        systems.sort(key=lambda system: system.position.distance_to(Vec3(x=0, y=0, z=0)))
        return systems

    def _colonized(self, world: WorldState) -> list[StarSystem]:
        return [system for system in world.systems if system.population > 0]

    def _uncolonized(self, world: WorldState) -> list[StarSystem]:
        return [system for system in world.systems if system.population <= 0]

    def _grow_systems(self, world: WorldState) -> None:
        for system in self._colonized(world):
            polity = self._polity(world, system.polity_id)
            science_trait_bonus = 0.025 if polity.trait == PolityTrait.FRONTIER_SCIENCE else 0.0
            frontier_bonus = system.black_hole_influence * (0.05 + science_trait_bonus)
            system.resources = max(0.0, system.resources + system.industry * 2.4 - system.population * 0.11)
            system.population *= 1.0 + min(0.045, 0.012 + system.resources / 9000)
            system.industry = min(5.0, system.industry + 0.006 + system.population * 0.0007)
            system.technology = min(1.0, system.technology + 0.0015 + frontier_bonus)

    def _send_directives(self, world: WorldState) -> None:
        capital = self._system(world, "sol")
        for system in self._colonized(world):
            if system.id == "sol" or system.polity_id != "empire":
                continue
            if self.rng.random() > 0.10 + self.config.centralization * 0.16:
                continue
            distance = capital.position.distance_to(system.position)
            delay = light_delay_years(distance)
            arrival = world.year + max(1, round(delay))
            world.messages.append(
                Message(
                    origin_id="sol",
                    destination_id=system.id,
                    polity_id="empire",
                    kind="directive",
                    sent_year=world.year,
                    arrival_year=arrival,
                    strength=0.05 + self.config.centralization * 0.12,
                )
            )

    def _deliver_messages(self, world: WorldState) -> None:
        for message in world.messages:
            if message.delivered or message.arrival_year > world.year:
                continue
            target = self._system(world, message.destination_id)
            noise = target.black_hole_influence * (world.black_hole.communication_noise if world.black_hole else 0.0)
            message_age = world.year - message.sent_year
            stale_friction = min(0.18, max(0.0, message_age - 2) * 0.012 * self.config.centralization)
            effect = max(0.0, message.strength - noise - stale_friction)
            target.loyalty = min(1.0, target.loyalty + effect)
            target.loyalty = max(0.0, target.loyalty - stale_friction * 0.35)
            target.autonomy = min(1.0, max(0.0, target.autonomy - effect * 0.45 + stale_friction * 0.75))
            message.delivered = True
            world.events.append(
                Event(
                    year=world.year,
                    event_type=EventType.MESSAGE,
                    title="Delayed directive received",
                    description=f"{target.name} received a {message_age} year old central order.",
                    system_ids=[target.id],
                    polity_ids=[target.polity_id],
                    impact=effect,
                )
            )

    def _launch_colony_fleets(self, world: WorldState) -> None:
        colonized = self._colonized(world)
        if len(colonized) >= min(world.config.star_count, 80):
            return
        active_colony_targets = {fleet.destination_id for fleet in world.fleets if not fleet.arrived and fleet.purpose == "colony"}
        launch_budget = sum(system.industry for system in colonized if system.polity_id == "empire")
        chance = min(0.62, world.config.expansion_pressure * 0.11 + launch_budget * 0.012)
        if self.rng.random() > chance:
            return
        candidates = [system for system in self._uncolonized(world) if system.id not in active_colony_targets]
        if not candidates:
            return
        origin = max(colonized, key=lambda system: system.industry if system.polity_id == "empire" else 0.0)
        target = min(candidates, key=lambda system: origin.position.distance_to(system.position))
        distance = origin.position.distance_to(target.position)
        duration = flight_duration_years(distance, world.config.ship_velocity_c)
        fleet = Fleet(
            origin_id=origin.id,
            destination_id=target.id,
            polity_id=origin.polity_id,
            launch_year=world.year,
            arrival_year=world.year + duration,
            velocity_c=world.config.ship_velocity_c,
            proper_time_years=proper_time_years(distance, world.config.ship_velocity_c),
        )
        origin.resources = max(0.0, origin.resources - 9.0)
        world.fleets.append(fleet)
        world.events.append(
            Event(
                year=world.year,
                event_type=EventType.FLEET,
                title="Colony fleet launched",
                description=f"{origin.name} launched a {fleet.velocity_c:.2f}c fleet toward {target.name}; crew proper time {fleet.proper_time_years:.1f}y.",
                system_ids=[origin.id, target.id],
                polity_ids=[origin.polity_id],
                impact=0.5,
            )
        )

    def _arrive_fleets(self, world: WorldState) -> None:
        for fleet in world.fleets:
            if fleet.arrived or fleet.arrival_year > world.year:
                continue
            target = self._system(world, fleet.destination_id)
            origin = self._system(world, fleet.origin_id)
            dilation_gap = (fleet.arrival_year - fleet.launch_year) - fleet.proper_time_years
            target.population = max(target.population, 0.18 + origin.population * 0.018)
            target.industry = max(target.industry, 0.12)
            target.technology = max(target.technology, origin.technology * (0.86 + self.rng.random() * 0.08))
            target.polity_id = fleet.polity_id
            target.colonized_year = world.year
            target.autonomy = min(0.9, 0.12 + dilation_gap * 0.012 + target.black_hole_influence * 0.18)
            target.loyalty = max(0.25, 0.78 - dilation_gap * 0.01)
            fleet.arrived = True
            world.events.append(
                Event(
                    year=world.year,
                    event_type=EventType.COLONIZATION,
                    title="Colony founded",
                    description=f"{target.name} was colonized after {fleet.arrival_year - fleet.launch_year} external years and {fleet.proper_time_years:.1f} ship years.",
                    system_ids=[target.id, origin.id],
                    polity_ids=[fleet.polity_id],
                    impact=0.9,
                )
            )

    def _trade_and_diffuse(self, world: WorldState) -> None:
        for route in world.trade_routes:
            a = self._system(world, route.a_id)
            b = self._system(world, route.b_id)
            if a.polity_id != b.polity_id and self.rng.random() < 0.35:
                route.risk += 0.08
            a_polity = self._polity(world, a.polity_id)
            b_polity = self._polity(world, b.polity_id)
            trade_modifier = 1.0
            if a_polity.trait == PolityTrait.TRADE_LEAGUE:
                trade_modifier += 0.16
            if b_polity.trait == PolityTrait.TRADE_LEAGUE:
                trade_modifier += 0.16
            if a_polity.trait == PolityTrait.ISOLATIONIST:
                trade_modifier -= 0.20
            if b_polity.trait == PolityTrait.ISOLATIONIST:
                trade_modifier -= 0.20
            if a_polity.trait == PolityTrait.MILITARIST or b_polity.trait == PolityTrait.MILITARIST:
                route.risk += 0.03
            if a_polity.trait == PolityTrait.TRADE_LEAGUE or b_polity.trait == PolityTrait.TRADE_LEAGUE:
                route.risk = max(0.0, route.risk - 0.025)
            route.risk = min(0.92, max(0.0, route.risk))
            trade_gain = route.throughput * max(0.25, trade_modifier) * (1.0 - route.risk)
            a.resources += trade_gain * 0.32
            b.resources += trade_gain * 0.32
            if a.technology > b.technology:
                b.technology += (a.technology - b.technology) * 0.012 * (1.0 - route.delay_years / 80)
            elif b.technology > a.technology:
                a.technology += (b.technology - a.technology) * 0.012 * (1.0 - route.delay_years / 80)

    def _update_politics(self, world: WorldState) -> None:
        capital = self._system(world, "sol")
        empire = self._polity(world, "empire")
        new_polities = []
        for system in self._colonized(world):
            if system.id == "sol" or system.polity_id != "empire":
                continue
            distance = capital.position.distance_to(system.position)
            delay_pressure = min(1.0, light_delay_years(distance) / 34)
            scarcity = max(0.0, 0.45 - system.resources / 140)
            centralist_bias = 1.12 if empire.trait == PolityTrait.CENTRALIST else 1.0
            command_friction = empire.centralization * delay_pressure * (1.0 - empire.autonomy_tolerance) * centralist_bias
            frontier_identity = system.black_hole_influence * 0.22
            system.autonomy = min(1.0, system.autonomy + 0.010 + command_friction * 0.05 + scarcity * 0.035 + frontier_identity * 0.02)
            system.loyalty = max(0.0, system.loyalty - command_friction * 0.035 - scarcity * 0.025)
            split_score = system.autonomy * 0.62 + (1.0 - system.loyalty) * 0.38
            if split_score > 0.78 and self.rng.random() < split_score * 0.08:
                trait = self._select_polity_trait(world, system, delay_pressure)
                polity = Polity(
                    id=f"polity_{len(world.polities) + len(new_polities) + 1}",
                    name=f"{system.name} Compact",
                    capital_system_id=system.id,
                    trait=trait,
                    centralization=max(0.15, empire.centralization * 0.55),
                    trade_openness=self._trait_trade_openness(trait),
                    militarization=self._trait_militarization(trait, system.black_hole_influence),
                    autonomy_tolerance=0.74 if trait == PolityTrait.FEDERALIST else 0.68,
                    color=self.rng.choice(["#f59e0b", "#a78bfa", "#22c55e", "#ef4444", "#14b8a6"]),
                )
                system.polity_id = polity.id
                system.autonomy = 0.52
                system.loyalty = 0.64
                new_polities.append(polity)
                world.events.append(
                    Event(
                        year=world.year,
                        event_type=EventType.POLITICS,
                        title="Frontier polity declared autonomy",
                        description=f"{system.name} formed a {trait.value} polity after delayed governance pushed autonomy to {split_score:.2f}.",
                        system_ids=[system.id],
                        polity_ids=[polity.id, "empire"],
                        impact=split_score,
                    )
                )
        world.polities.extend(new_polities)

    def _update_war_tension(self, world: WorldState) -> None:
        independent = [system for system in self._colonized(world) if system.polity_id != "empire"]
        frontier = len(independent)
        central = self.config.centralization
        average_distance = mean([system.position.distance_to(self._system(world, "sol").position) for system in independent] or [0.0])
        militarist_count = len([polity for polity in world.polities if polity.trait == PolityTrait.MILITARIST])
        trade_league_count = len([polity for polity in world.polities if polity.trait == PolityTrait.TRADE_LEAGUE])
        tension = min(1.0, frontier * 0.045 + central * 0.25 + average_distance / 180 + militarist_count * 0.05 - trade_league_count * 0.025)
        deterrence = min(1.0, len([fleet for fleet in world.fleets if not fleet.arrived]) * 0.03 + central * 0.24 + militarist_count * 0.08)
        world.war = WarState(tension=tension, active_conflicts=0, deterrence=deterrence)
        cold_war = self._cold_war_metrics(world)
        conflicts = 1 if cold_war.escalation_risk > 0.72 and self.rng.random() < cold_war.escalation_risk * 0.05 else 0
        world.war = WarState(tension=tension, active_conflicts=conflicts, deterrence=deterrence)
        if conflicts:
            world.events.append(
                Event(
                    year=world.year,
                    event_type=EventType.WAR,
                    title="Cold war alert",
                    description="Delayed fleet intelligence produced a frontier mobilization spiral.",
                    polity_ids=[p.id for p in world.polities[:3]],
                    impact=tension,
                )
            )
        elif cold_war.recall_delay > 0.45 and self.rng.random() < cold_war.recall_delay * 0.03:
            world.events.append(
                Event(
                    year=world.year,
                    event_type=EventType.WAR,
                    title="Fleet recall delayed",
                    description="Command authority discovered that frontier fleet orders would arrive too late to reverse deployment.",
                    polity_ids=[p.id for p in world.polities[:3]],
                    impact=cold_war.recall_delay,
                )
            )
        elif cold_war.deterrence_stability > 0.55 and militarist_count > 0 and self.rng.random() < 0.025:
            world.events.append(
                Event(
                    year=world.year,
                    event_type=EventType.WAR,
                    title="Frontier deterrence pact",
                    description="Rival polities stabilized a delayed-response deterrence channel.",
                    polity_ids=[p.id for p in world.polities[:4]],
                    impact=cold_war.deterrence_stability,
                )
            )
        elif trade_league_count > 0 and tension > 0.28 and self.rng.random() < 0.03:
            world.events.append(
                Event(
                    year=world.year,
                    event_type=EventType.TRADE,
                    title="Trade league mediation",
                    description="Merchant polities damped a frontier escalation spiral through redundant trade channels.",
                    polity_ids=[p.id for p in world.polities if p.trait == PolityTrait.TRADE_LEAGUE],
                    impact=max(0.0, 1.0 - cold_war.escalation_risk),
                )
            )

    def _build_trade_routes(self, world: WorldState) -> None:
        routes = []
        colonized = self._colonized(world)
        for a, b in combinations(colonized, 2):
            distance = a.position.distance_to(b.position)
            if distance > 18:
                continue
            delay = light_delay_years(distance)
            black_hole_penalty = max(a.black_hole_influence, b.black_hole_influence) * (world.black_hole.trade_penalty if world.black_hole else 0.0)
            a_polity = self._polity(world, a.polity_id)
            b_polity = self._polity(world, b.polity_id)
            trait_risk = 0.0
            if a_polity.trait == PolityTrait.MILITARIST or b_polity.trait == PolityTrait.MILITARIST:
                trait_risk += 0.05
            if a_polity.trait == PolityTrait.TRADE_LEAGUE or b_polity.trait == PolityTrait.TRADE_LEAGUE:
                trait_risk -= 0.04
            if a_polity.trait == PolityTrait.ISOLATIONIST or b_polity.trait == PolityTrait.ISOLATIONIST:
                trait_risk += 0.04
            risk = min(0.85, max(0.0, delay / 70 + black_hole_penalty + trait_risk + (0.12 if a.polity_id != b.polity_id else 0.0)))
            throughput_modifier = 1.0
            if a_polity.trait == PolityTrait.TRADE_LEAGUE or b_polity.trait == PolityTrait.TRADE_LEAGUE:
                throughput_modifier += 0.22
            if a_polity.trait == PolityTrait.ISOLATIONIST or b_polity.trait == PolityTrait.ISOLATIONIST:
                throughput_modifier -= 0.24
            throughput = max(0.0, (a.industry + b.industry) * 0.5 * throughput_modifier * (1.0 - distance / 22))
            routes.append(
                TradeRoute(
                    id=f"route_{a.id}_{b.id}",
                    a_id=a.id,
                    b_id=b.id,
                    distance_ly=round(distance, 3),
                    delay_years=round(delay, 3),
                    throughput=round(throughput, 4),
                    risk=round(risk, 4),
                )
            )
        routes.sort(key=lambda route: route.throughput, reverse=True)
        world.trade_routes = routes[:90]

    def _measure(self, world: WorldState) -> RelativisticMetrics:
        colonized = self._colonized(world)
        capital = self._system(world, "sol")
        delays = [capital.position.distance_to(system.position) for system in colonized if system.id != "sol"]
        central_systems = [system for system in colonized if system.polity_id == "empire"]
        avg_autonomy = mean([system.autonomy for system in colonized] or [0.0])
        avg_loyalty = mean([system.loyalty for system in central_systems] or [0.0])
        technology_values = [system.technology for system in colonized]
        tech_diffusion = 1.0 - (max(technology_values) - min(technology_values) if len(technology_values) > 1 else 0.0)
        empire = self._polity(world, "empire")
        unresolved_autonomy = max(0.0, avg_autonomy - empire.autonomy_tolerance * 0.85)
        command_pressure = empire.centralization * (1.0 - empire.autonomy_tolerance) * self._command_trait_modifier(empire.trait)
        command_component = command_pressure * 0.16
        delay_component = (mean(delays or [0.0]) / 95) * (0.45 + command_pressure)
        autonomy_component = unresolved_autonomy * 0.52
        loyalty_component = (1.0 - avg_loyalty) * 0.24
        split_risk = min(1.0, autonomy_component + loyalty_component + delay_component + command_component)
        rounded_split_risk = round(split_risk, 4)
        risk_breakdown = RiskBreakdown(
            command_pressure=round(command_component, 4),
            delay_pressure=round(delay_component, 4),
            unresolved_autonomy=round(autonomy_component, 4),
            loyalty_loss=round(loyalty_component, 4),
            total_split_risk=rounded_split_risk,
        )
        return RelativisticMetrics(
            year=world.year,
            colonized_systems=len(colonized),
            polities=len({system.polity_id for system in colonized}),
            central_control=round(len(central_systems) / max(1, len(colonized)), 4),
            average_delay=round(mean(delays or [0.0]), 3),
            autonomy=round(avg_autonomy, 4),
            split_risk=rounded_split_risk,
            trade_throughput=round(sum(route.throughput * (1.0 - route.risk) for route in world.trade_routes), 4),
            war_tension=round(world.war.tension, 4),
            technology_diffusion=round(max(0.0, min(1.0, tech_diffusion)), 4),
            fleet_count=len([fleet for fleet in world.fleets if not fleet.arrived]),
            risk_breakdown=risk_breakdown,
            cold_war=self._cold_war_metrics(world),
        )

    def _system(self, world: WorldState, system_id: str) -> StarSystem:
        return next(system for system in world.systems if system.id == system_id)

    def _polity(self, world: WorldState, polity_id: str) -> Polity:
        return next(polity for polity in world.polities if polity.id == polity_id)

    def _select_polity_trait(self, world: WorldState, system: StarSystem, delay_pressure: float) -> PolityTrait:
        local_trade = sum(route.throughput for route in world.trade_routes if system.id in {route.a_id, route.b_id})
        if system.black_hole_influence > 0.45:
            return PolityTrait.FRONTIER_SCIENCE
        if world.war.tension > 0.62:
            return PolityTrait.MILITARIST
        if delay_pressure > 0.62 and self.config.centralization > 0.55:
            return PolityTrait.FEDERALIST
        if local_trade > 0.85:
            return PolityTrait.TRADE_LEAGUE
        if system.autonomy > 0.72 and local_trade < 0.25:
            return PolityTrait.ISOLATIONIST
        return self.rng.choice([PolityTrait.FEDERALIST, PolityTrait.TRADE_LEAGUE, PolityTrait.ISOLATIONIST])

    def _trait_trade_openness(self, trait: PolityTrait) -> float:
        return {
            PolityTrait.CENTRALIST: 0.50,
            PolityTrait.FEDERALIST: 0.58,
            PolityTrait.TRADE_LEAGUE: 0.82,
            PolityTrait.MILITARIST: 0.46,
            PolityTrait.FRONTIER_SCIENCE: 0.60,
            PolityTrait.ISOLATIONIST: 0.24,
        }[trait]

    def _trait_militarization(self, trait: PolityTrait, black_hole_influence: float) -> float:
        base = {
            PolityTrait.CENTRALIST: 0.30,
            PolityTrait.FEDERALIST: 0.18,
            PolityTrait.TRADE_LEAGUE: 0.14,
            PolityTrait.MILITARIST: 0.58,
            PolityTrait.FRONTIER_SCIENCE: 0.22,
            PolityTrait.ISOLATIONIST: 0.28,
        }[trait]
        return min(0.88, base + black_hole_influence * 0.18)

    def _command_trait_modifier(self, trait: PolityTrait) -> float:
        return {
            PolityTrait.CENTRALIST: 1.12,
            PolityTrait.FEDERALIST: 0.64,
            PolityTrait.TRADE_LEAGUE: 0.82,
            PolityTrait.MILITARIST: 1.02,
            PolityTrait.FRONTIER_SCIENCE: 0.90,
            PolityTrait.ISOLATIONIST: 0.76,
        }[trait]

    def _cold_war_metrics(self, world: WorldState) -> ColdWarMetrics:
        colonized = self._colonized(world)
        capital = self._system(world, "sol")
        active_fleets = [fleet for fleet in world.fleets if not fleet.arrived]
        delays = [capital.position.distance_to(system.position) for system in colonized if system.id != "sol"]
        recall_delay = min(1.0, mean(delays or [0.0]) / 60)
        frontier_polities = [polity for polity in world.polities if polity.id != "empire"]
        militarization = mean([polity.militarization for polity in frontier_polities] or [0.0])
        militarist_bonus = len([polity for polity in frontier_polities if polity.trait == PolityTrait.MILITARIST]) * 0.08
        trade_damping = len([polity for polity in frontier_polities if polity.trait == PolityTrait.TRADE_LEAGUE]) * 0.045
        polity_pressure = min(1.0, max(0, len(frontier_polities)) / 8)
        fleet_pressure = min(1.0, len(active_fleets) / 10)
        first_strike = min(1.0, recall_delay * 0.34 + fleet_pressure * 0.24 + militarization * 0.26 + world.config.centralization * 0.16 + militarist_bonus)
        deterrence = min(1.0, world.war.deterrence * 0.46 + fleet_pressure * 0.24 + militarization * 0.18 + max(0.0, 1.0 - recall_delay) * 0.12)
        escalation = min(1.0, first_strike * 0.48 + polity_pressure * 0.20 + world.war.tension * 0.28 - deterrence * 0.18 - trade_damping)
        stability = min(1.0, max(0.0, deterrence * 0.64 + trade_damping + (1.0 - escalation) * 0.22))
        return ColdWarMetrics(
            deterrence_stability=round(stability, 4),
            first_strike_pressure=round(first_strike, 4),
            recall_delay=round(recall_delay, 4),
            escalation_risk=round(max(0.0, escalation), 4),
            frontier_militarization=round(min(1.0, militarization + militarist_bonus), 4),
        )
