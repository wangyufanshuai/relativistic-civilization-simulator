import type { ExperimentMetricKey, RiskBreakdown, SweepParameter } from "../../types/sim";

export const parameterDefaults: Record<SweepParameter, number[]> = {
  centralization: [0.15, 0.3, 0.45, 0.6, 0.75, 0.9],
  ship_velocity_c: [0.18, 0.3, 0.45, 0.6, 0.78, 0.92],
  expansion_pressure: [0.18, 0.32, 0.46, 0.6, 0.74, 0.88],
  federation_bias: [0, 0.18, 0.36, 0.54, 0.72, 0.9]
};

export const metricLabels: Record<ExperimentMetricKey, string> = {
  split_risk: "split risk",
  central_control: "central control",
  war_tension: "war tension",
  trade_throughput: "trade throughput",
  escalation_risk: "escalation risk",
  deterrence_stability: "deterrence stability"
};

export const riskFactorLabels: Array<[keyof RiskBreakdown, string]> = [
  ["command_pressure", "command"],
  ["delay_pressure", "delay"],
  ["unresolved_autonomy", "autonomy"],
  ["loyalty_loss", "loyalty"]
];

export const experimentPresets: Array<{
  id: string;
  label: string;
  scenario: string;
  parameter: SweepParameter;
  metric: ExperimentMetricKey;
  values: number[];
}> = [
  {
    id: "central-command-delay",
    label: "Central command stress",
    scenario: "centralized_command",
    parameter: "centralization",
    metric: "split_risk",
    values: [0.2, 0.38, 0.56, 0.74, 0.9]
  },
  {
    id: "fleet-speed-cold-war",
    label: "Fleet speed cold war",
    scenario: "near_light_migration",
    parameter: "ship_velocity_c",
    metric: "escalation_risk",
    values: [0.18, 0.34, 0.5, 0.66, 0.82, 0.94]
  },
  {
    id: "federal-deterrence",
    label: "Federal deterrence",
    scenario: "federated_network",
    parameter: "federation_bias",
    metric: "deterrence_stability",
    values: [0, 0.18, 0.36, 0.54, 0.72, 0.9]
  },
  {
    id: "black-hole-frontier",
    label: "Black hole frontier",
    scenario: "black_hole_frontier",
    parameter: "expansion_pressure",
    metric: "trade_throughput",
    values: [0.18, 0.32, 0.46, 0.6, 0.74, 0.88]
  }
];
