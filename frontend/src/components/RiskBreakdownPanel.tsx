import { AlertTriangle } from "lucide-react";
import type { Metric, RiskBreakdown } from "../types/sim";

const factorLabels: Array<[keyof RiskBreakdown, string, string]> = [
  ["command_pressure", "command pressure", "#22d3ee"],
  ["delay_pressure", "delay pressure", "#f59e0b"],
  ["unresolved_autonomy", "unresolved autonomy", "#a78bfa"],
  ["loyalty_loss", "loyalty loss", "#ef4444"]
];

export function RiskBreakdownPanel({ metric }: { metric?: Metric }) {
  const breakdown = metric?.risk_breakdown;
  const dominant = breakdown
    ? factorLabels
        .map(([key, label]) => ({ key, label, value: Number(breakdown[key]) }))
        .sort((a, b) => b.value - a.value)[0]
    : undefined;
  const total = breakdown?.total_split_risk ?? 0;
  return (
    <section className="panel riskPanel">
      <div className="panelHeader">
        <span>risk breakdown</span>
        <AlertTriangle size={16} />
      </div>
      <div className="stackedRisk" aria-label="split risk contribution bar">
        {factorLabels.map(([key, label, color]) => {
          const value = breakdown ? Number(breakdown[key]) : 0;
          return <i key={key} title={`${label}: ${Math.round(value * 100)}%`} style={{ width: `${Math.max(2, value * 100)}%`, background: color }} />;
        })}
      </div>
      <dl className="riskList">
        {factorLabels.map(([key, label, color]) => {
          const value = breakdown ? Number(breakdown[key]) : 0;
          return (
            <div key={key}>
              <dt><i style={{ background: color }} />{label}</dt>
              <dd>{Math.round(value * 100)}%</dd>
            </div>
          );
        })}
      </dl>
      <p>
        {dominant
          ? `${dominant.label} dominates this risk point. Total split risk is ${Math.round(total * 100)}%.`
          : "Run or replay a simulation to explain the current split risk."}
      </p>
    </section>
  );
}

