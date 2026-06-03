import type { Metric } from "../types/sim";

const metricDefs: Array<[keyof Metric, string, (value: number) => string]> = [
  ["central_control", "central control", (value) => `${Math.round(value * 100)}%`],
  ["average_delay", "avg delay", (value) => `${value.toFixed(1)}y`],
  ["autonomy", "autonomy", (value) => `${Math.round(value * 100)}%`],
  ["split_risk", "split risk", (value) => `${Math.round(value * 100)}%`],
  ["trade_throughput", "trade", (value) => value.toFixed(1)],
  ["war_tension", "war tension", (value) => `${Math.round(value * 100)}%`]
];

export function MetricStrip({ metric }: { metric?: Metric }) {
  return (
    <section className="metricStrip">
      {metricDefs.map(([key, label, format]) => {
        const value = metric ? Number(metric[key]) : 0;
        return (
          <div className="metricTile" key={key}>
            <span>{label}</span>
            <strong>{format(value)}</strong>
            <div className="meter">
              <i style={{ width: `${Math.min(100, Math.max(4, key === "average_delay" || key === "trade_throughput" ? value : value * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

