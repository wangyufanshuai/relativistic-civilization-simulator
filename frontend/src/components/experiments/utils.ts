import type { ExperimentMetricKey, Metric } from "../../types/sim";

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDelta(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 100)}%`;
}

export function metricValue(metric: Metric, key: ExperimentMetricKey) {
  if (key === "escalation_risk") return metric.cold_war.escalation_risk;
  if (key === "deterrence_stability") return metric.cold_war.deterrence_stability;
  return Number(metric[key]);
}

export function downloadMarkdown(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
