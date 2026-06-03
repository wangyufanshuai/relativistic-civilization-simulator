from __future__ import annotations

from enum import Enum
from math import sqrt
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class EventType(str, Enum):
    COLONIZATION = "colonization"
    MESSAGE = "message"
    TRADE = "trade"
    POLITICS = "politics"
    WAR = "war"
    TECHNOLOGY = "technology"
    BLACK_HOLE = "black_hole"
    FLEET = "fleet"


class Vec3(BaseModel):
    x: float
    y: float
    z: float

    def distance_to(self, other: "Vec3") -> float:
        return sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2 + (self.z - other.z) ** 2)


class StarSystem(BaseModel):
    id: str
    name: str
    position: Vec3
    population: float = 0.0
    resources: float = 0.0
    industry: float = 0.0
    technology: float = 0.12
    autonomy: float = 0.0
    loyalty: float = 1.0
    polity_id: str = "empire"
    colonized_year: int | None = None
    black_hole_influence: float = 0.0


class PolityTrait(str, Enum):
    CENTRALIST = "centralist"
    FEDERALIST = "federalist"
    TRADE_LEAGUE = "trade_league"
    MILITARIST = "militarist"
    FRONTIER_SCIENCE = "frontier_science"
    ISOLATIONIST = "isolationist"


class Polity(BaseModel):
    id: str
    name: str
    capital_system_id: str
    trait: PolityTrait = PolityTrait.CENTRALIST
    centralization: float = 0.55
    trade_openness: float = 0.55
    militarization: float = 0.28
    autonomy_tolerance: float = 0.45
    color: str = "#38bdf8"


class Civilization(BaseModel):
    id: str = "civ_root"
    name: str = "Sol Mandate"
    origin_system_id: str = "sol"
    ethics_drift: float = 0.0


class Fleet(BaseModel):
    id: str = Field(default_factory=lambda: f"fleet_{uuid4().hex[:8]}")
    origin_id: str
    destination_id: str
    polity_id: str
    purpose: Literal["colony", "patrol"] = "colony"
    launch_year: int
    arrival_year: int
    velocity_c: float = Field(gt=0.0, lt=1.0)
    proper_time_years: float
    arrived: bool = False


class Message(BaseModel):
    id: str = Field(default_factory=lambda: f"msg_{uuid4().hex[:8]}")
    origin_id: str
    destination_id: str
    polity_id: str
    kind: Literal["directive", "tax", "treaty", "warning"] = "directive"
    sent_year: int
    arrival_year: int
    strength: float = 0.2
    delivered: bool = False


class TradeRoute(BaseModel):
    id: str
    a_id: str
    b_id: str
    distance_ly: float
    delay_years: float
    throughput: float
    risk: float


class WarState(BaseModel):
    tension: float = 0.0
    active_conflicts: int = 0
    deterrence: float = 0.0


class BlackHoleZone(BaseModel):
    id: str = "bh_frontier"
    name: str = "Kerr Frontier"
    position: Vec3
    radius_ly: float = 8.0
    research_bonus: float = 0.08
    trade_penalty: float = 0.35
    communication_noise: float = 0.22


class RiskBreakdown(BaseModel):
    command_pressure: float = 0.0
    delay_pressure: float = 0.0
    unresolved_autonomy: float = 0.0
    loyalty_loss: float = 0.0
    total_split_risk: float = 0.0


class ColdWarMetrics(BaseModel):
    deterrence_stability: float = 0.0
    first_strike_pressure: float = 0.0
    recall_delay: float = 0.0
    escalation_risk: float = 0.0
    frontier_militarization: float = 0.0


class RelativisticMetrics(BaseModel):
    year: int
    colonized_systems: int
    polities: int
    central_control: float
    average_delay: float
    autonomy: float
    split_risk: float
    trade_throughput: float
    war_tension: float
    technology_diffusion: float
    fleet_count: int
    risk_breakdown: RiskBreakdown = Field(default_factory=RiskBreakdown)
    cold_war: ColdWarMetrics = Field(default_factory=ColdWarMetrics)


class Event(BaseModel):
    year: int
    event_type: EventType
    title: str
    description: str
    system_ids: list[str] = Field(default_factory=list)
    polity_ids: list[str] = Field(default_factory=list)
    impact: float = 0.0


class SimulationConfig(BaseModel):
    scenario: str = "baseline_empire"
    seed: int = 42
    star_count: int = Field(default=56, ge=20, le=120)
    years_per_step: int = Field(default=1, ge=1, le=10)
    ship_velocity_c: float = Field(default=0.45, gt=0.05, lt=0.99)
    expansion_pressure: float = Field(default=0.42, ge=0.0, le=1.0)
    centralization: float = Field(default=0.58, ge=0.0, le=1.0)
    federation_bias: float = Field(default=0.0, ge=0.0, le=1.0)
    black_hole_frontier: bool = True


class WorldState(BaseModel):
    run_id: str = Field(default_factory=lambda: uuid4().hex[:12])
    year: int = 0
    config: SimulationConfig
    civilization: Civilization = Field(default_factory=Civilization)
    systems: list[StarSystem]
    polities: list[Polity]
    fleets: list[Fleet] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)
    trade_routes: list[TradeRoute] = Field(default_factory=list)
    war: WarState = Field(default_factory=WarState)
    black_hole: BlackHoleZone | None = None
    events: list[Event] = Field(default_factory=list)
    metrics: list[RelativisticMetrics] = Field(default_factory=list)


class WorldSnapshot(BaseModel):
    year: int
    systems: list[StarSystem]
    polities: list[Polity]
    fleets: list[Fleet] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)
    trade_routes: list[TradeRoute] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    metrics: RelativisticMetrics


class Scenario(BaseModel):
    id: str
    name: str
    description: str
    overrides: dict[str, Any] = Field(default_factory=dict)


class StartSimulationRequest(BaseModel):
    scenario: str = "baseline_empire"
    seed: int | None = None


class StepSimulationRequest(BaseModel):
    run_id: str
    steps: int = Field(default=1, ge=1, le=250)


class RunSimulationRequest(BaseModel):
    scenario: str = "baseline_empire"
    seed: int | None = None
    steps: int = Field(default=80, ge=1, le=1000)
    include_snapshots: bool = True


SweepParameter = Literal["centralization", "ship_velocity_c", "expansion_pressure", "federation_bias"]
ExperimentReportKind = Literal["counterfactual", "sweep", "sensitivity"]


class SweepRequest(BaseModel):
    scenario: str = "baseline_empire"
    parameter: SweepParameter = "centralization"
    values: list[float] = Field(default_factory=lambda: [0.2, 0.4, 0.6, 0.8], min_length=2, max_length=16)
    steps: int = Field(default=120, ge=1, le=1000)
    seed: int = 42
    include_snapshots: bool = False


class ExperimentRun(BaseModel):
    parameter_value: float
    final_metrics: RelativisticMetrics
    timeline: list[RelativisticMetrics]
    peak_split_risk: float
    year_of_first_split: int | None = None
    max_polities: int
    average_trade_throughput: float
    peak_risk_breakdown: RiskBreakdown = Field(default_factory=RiskBreakdown)
    snapshots: list[WorldSnapshot] = Field(default_factory=list)


class ExperimentSummary(BaseModel):
    best_stability_value: float
    highest_split_risk_value: float
    dominant_trend: str
    recommendation: str


class SweepResult(BaseModel):
    scenario: str
    parameter: SweepParameter
    runs: list[ExperimentRun]
    summary: ExperimentSummary


class CounterfactualOverrides(BaseModel):
    model_config = ConfigDict(extra="forbid")

    centralization: float | None = Field(default=None, ge=0.0, le=1.0)
    ship_velocity_c: float | None = Field(default=None, gt=0.05, lt=0.99)
    expansion_pressure: float | None = Field(default=None, ge=0.0, le=1.0)
    federation_bias: float | None = Field(default=None, ge=0.0, le=1.0)


class ForkSimulationRequest(BaseModel):
    run_id: str
    snapshot_year: int = Field(ge=0)
    steps: int = Field(default=80, ge=1, le=1000)
    overrides: CounterfactualOverrides = Field(default_factory=CounterfactualOverrides)
    include_snapshots: bool = True


class CounterfactualRequest(BaseModel):
    run_id: str
    snapshot_year: int = Field(default=40, ge=0)
    steps: int = Field(default=80, ge=1, le=1000)
    overrides: CounterfactualOverrides = Field(default_factory=CounterfactualOverrides)


class CounterfactualBranch(BaseModel):
    run_id: str
    final_metrics: RelativisticMetrics
    timeline: list[RelativisticMetrics]
    snapshots: list[WorldSnapshot] = Field(default_factory=list)
    peak_split_risk: float
    year_of_first_split: int | None = None
    dominant_risk_factor: str


class CausalDelta(BaseModel):
    split_risk_delta: float
    central_control_delta: float
    first_split_year_delta: int | None = None
    peak_split_risk_delta: float
    escalation_risk_delta: float = 0.0
    deterrence_stability_delta: float = 0.0
    dominant_risk_factor_before: str
    dominant_risk_factor_after: str
    interpretation: str


class CounterfactualResult(BaseModel):
    base_run_id: str
    fork_run_id: str
    snapshot_year: int
    overrides: dict[str, float]
    original: CounterfactualBranch
    counterfactual: CounterfactualBranch
    delta: CausalDelta
    summary: str


class ExperimentReportRequest(BaseModel):
    kind: ExperimentReportKind
    payload: dict[str, Any]


class MonteCarloRequest(BaseModel):
    scenario: str = "baseline_empire"
    seeds: list[int] = Field(default_factory=lambda: list(range(20, 40)), min_length=3, max_length=100)
    steps: int = Field(default=120, ge=1, le=1000)


class MonteCarloSeedRun(BaseModel):
    seed: int
    final_metrics: RelativisticMetrics
    year_of_first_split: int | None = None
    max_polities: int


class MetricStats(BaseModel):
    mean: float
    stddev: float
    ci95_low: float
    ci95_high: float


class MonteCarloSummary(BaseModel):
    split_risk: MetricStats
    central_control: MetricStats
    escalation_risk: MetricStats
    trade_throughput: MetricStats
    split_probability: float
    first_split_year_mean: float | None = None
    interpretation: str


class MonteCarloResult(BaseModel):
    scenario: str
    steps: int
    seeds: list[int]
    runs: list[MonteCarloSeedRun]
    summary: MonteCarloSummary


class SensitivityRequest(BaseModel):
    scenario: str = "baseline_empire"
    parameters: list[SweepParameter] = Field(
        default_factory=lambda: ["centralization", "ship_velocity_c", "expansion_pressure", "federation_bias"],
        min_length=1,
        max_length=4,
    )
    steps: int = Field(default=120, ge=1, le=1000)
    seed_start: int = 200
    seed_count: int = Field(default=8, ge=3, le=50)
    perturbation: float = Field(default=0.22, ge=0.05, le=0.45)


class SensitivityParameterResult(BaseModel):
    parameter: SweepParameter
    baseline_value: float
    low_value: float
    high_value: float
    split_risk_low: MetricStats
    split_risk_baseline: MetricStats
    split_risk_high: MetricStats
    central_control_delta: float
    split_risk_delta: float
    escalation_risk_delta: float
    trade_throughput_delta: float
    sensitivity_score: float
    confidence: str
    interpretation: str


class SensitivitySummary(BaseModel):
    strongest_parameter: SweepParameter
    dominant_effect: str
    recommendation: str


class SensitivityResult(BaseModel):
    scenario: str
    steps: int
    seeds: list[int]
    results: list[SensitivityParameterResult]
    summary: SensitivitySummary


class ArchivedRun(BaseModel):
    run_id: str
    scenario: str
    year: int
    created_at: str
    updated_at: str
    pinned: bool = False
    final_metrics: RelativisticMetrics
    config: SimulationConfig
    event_count: int
    snapshot_count: int
    report_available: bool = False


class ArchiveRunDetail(BaseModel):
    summary: ArchivedRun
    state: WorldState
    metrics: list[RelativisticMetrics]
    events: list[Event]
    snapshots: list[WorldSnapshot]
