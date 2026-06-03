export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StarSystem {
  id: string;
  name: string;
  position: Vec3;
  population: number;
  resources: number;
  industry: number;
  technology: number;
  autonomy: number;
  loyalty: number;
  polity_id: string;
  colonized_year: number | null;
  black_hole_influence: number;
}

export interface Polity {
  id: string;
  name: string;
  capital_system_id: string;
  trait: PolityTrait;
  centralization: number;
  trade_openness: number;
  militarization: number;
  autonomy_tolerance: number;
  color: string;
}

export type PolityTrait = "centralist" | "federalist" | "trade_league" | "militarist" | "frontier_science" | "isolationist";

export interface Fleet {
  id: string;
  origin_id: string;
  destination_id: string;
  polity_id: string;
  purpose: "colony" | "patrol";
  launch_year: number;
  arrival_year: number;
  velocity_c: number;
  proper_time_years: number;
  arrived: boolean;
}

export interface Message {
  id: string;
  origin_id: string;
  destination_id: string;
  polity_id: string;
  kind: "directive" | "tax" | "treaty" | "warning";
  sent_year: number;
  arrival_year: number;
  strength: number;
  delivered: boolean;
}

export interface TradeRoute {
  id: string;
  a_id: string;
  b_id: string;
  distance_ly: number;
  delay_years: number;
  throughput: number;
  risk: number;
}

export interface BlackHoleZone {
  id: string;
  name: string;
  position: Vec3;
  radius_ly: number;
  research_bonus: number;
  trade_penalty: number;
  communication_noise: number;
}

export interface Metric {
  year: number;
  colonized_systems: number;
  polities: number;
  central_control: number;
  average_delay: number;
  autonomy: number;
  split_risk: number;
  trade_throughput: number;
  war_tension: number;
  technology_diffusion: number;
  fleet_count: number;
  risk_breakdown: RiskBreakdown;
  cold_war: ColdWarMetrics;
}

export interface RiskBreakdown {
  command_pressure: number;
  delay_pressure: number;
  unresolved_autonomy: number;
  loyalty_loss: number;
  total_split_risk: number;
}

export interface ColdWarMetrics {
  deterrence_stability: number;
  first_strike_pressure: number;
  recall_delay: number;
  escalation_risk: number;
  frontier_militarization: number;
}

export interface SimEvent {
  year: number;
  event_type: string;
  title: string;
  description: string;
  system_ids: string[];
  polity_ids: string[];
  impact: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  overrides: Record<string, unknown>;
}

export interface WorldState {
  run_id: string;
  year: number;
  config: {
    scenario: string;
    seed: number;
    ship_velocity_c: number;
    expansion_pressure: number;
    centralization: number;
    federation_bias: number;
  };
  systems: StarSystem[];
  polities: Polity[];
  fleets: Fleet[];
  messages: Message[];
  trade_routes: TradeRoute[];
  black_hole: BlackHoleZone | null;
  events: SimEvent[];
  metrics: Metric[];
  latest: Metric;
}

export interface WorldSnapshot {
  year: number;
  systems: StarSystem[];
  polities: Polity[];
  fleets: Fleet[];
  messages: Message[];
  trade_routes: TradeRoute[];
  events: SimEvent[];
  metrics: Metric;
}

export type SweepParameter = "centralization" | "ship_velocity_c" | "expansion_pressure" | "federation_bias";
export type ExperimentMetricKey = "split_risk" | "central_control" | "war_tension" | "trade_throughput" | "escalation_risk" | "deterrence_stability";

export interface ExperimentRun {
  parameter_value: number;
  final_metrics: Metric;
  timeline: Metric[];
  peak_split_risk: number;
  year_of_first_split: number | null;
  max_polities: number;
  average_trade_throughput: number;
  peak_risk_breakdown: RiskBreakdown;
  snapshots: WorldSnapshot[];
}

export interface ExperimentSummary {
  best_stability_value: number;
  highest_split_risk_value: number;
  dominant_trend: string;
  recommendation: string;
}

export interface SweepResult {
  scenario: string;
  parameter: SweepParameter;
  runs: ExperimentRun[];
  summary: ExperimentSummary;
}

export interface ScenarioCompareResult extends Metric {
  scenario: string;
}

export type CounterfactualOverrides = Partial<Record<SweepParameter, number>>;

export interface CounterfactualBranch {
  run_id: string;
  final_metrics: Metric;
  timeline: Metric[];
  snapshots: WorldSnapshot[];
  peak_split_risk: number;
  year_of_first_split: number | null;
  dominant_risk_factor: keyof RiskBreakdown;
}

export interface CausalDelta {
  split_risk_delta: number;
  central_control_delta: number;
  first_split_year_delta: number | null;
  peak_split_risk_delta: number;
  escalation_risk_delta: number;
  deterrence_stability_delta: number;
  dominant_risk_factor_before: keyof RiskBreakdown;
  dominant_risk_factor_after: keyof RiskBreakdown;
  interpretation: string;
}

export interface CounterfactualResult {
  base_run_id: string;
  fork_run_id: string;
  snapshot_year: number;
  overrides: CounterfactualOverrides;
  original: CounterfactualBranch;
  counterfactual: CounterfactualBranch;
  delta: CausalDelta;
  summary: string;
}

export interface ArchivedRun {
  run_id: string;
  scenario: string;
  year: number;
  created_at: string;
  updated_at: string;
  pinned: boolean;
  final_metrics: Metric;
  config: WorldState["config"];
  event_count: number;
  snapshot_count: number;
  report_available: boolean;
}

export interface ArchiveRunDetail {
  summary: ArchivedRun;
  state: WorldState;
  metrics: Metric[];
  events: SimEvent[];
  snapshots: WorldSnapshot[];
}

export interface MetricStats {
  mean: number;
  stddev: number;
  ci95_low: number;
  ci95_high: number;
}

export interface MonteCarloSeedRun {
  seed: number;
  final_metrics: Metric;
  year_of_first_split: number | null;
  max_polities: number;
}

export interface MonteCarloSummary {
  split_risk: MetricStats;
  central_control: MetricStats;
  escalation_risk: MetricStats;
  trade_throughput: MetricStats;
  split_probability: number;
  first_split_year_mean: number | null;
  interpretation: string;
}

export interface MonteCarloResult {
  scenario: string;
  steps: number;
  seeds: number[];
  runs: MonteCarloSeedRun[];
  summary: MonteCarloSummary;
}

export interface SensitivityParameterResult {
  parameter: SweepParameter;
  baseline_value: number;
  low_value: number;
  high_value: number;
  split_risk_low: MetricStats;
  split_risk_baseline: MetricStats;
  split_risk_high: MetricStats;
  central_control_delta: number;
  split_risk_delta: number;
  escalation_risk_delta: number;
  trade_throughput_delta: number;
  sensitivity_score: number;
  confidence: "low" | "medium" | "high";
  interpretation: string;
}

export interface SensitivitySummary {
  strongest_parameter: SweepParameter;
  dominant_effect: string;
  recommendation: string;
}

export interface SensitivityResult {
  scenario: string;
  steps: number;
  seeds: number[];
  results: SensitivityParameterResult[];
  summary: SensitivitySummary;
}
