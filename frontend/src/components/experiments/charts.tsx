import type { CounterfactualResult, ExperimentMetricKey, MetricStats, MonteCarloResult, SensitivityResult, SweepResult } from "../../types/sim";
import { metricValue, percent } from "./utils";

export function SweepChart({ result, metric }: { result?: SweepResult; metric: ExperimentMetricKey }) {
  const points = (result?.runs ?? []).map((run) => ({
    x: run.parameter_value,
    y: metricValue(run.final_metrics, metric)
  }));
  return <LineSvg points={points} formatY={(value) => (metric === "trade_throughput" ? value.toFixed(1) : `${Math.round(value * 100)}%`)} />;
}

export function ScatterChart({ result }: { result?: SweepResult }) {
  const points = (result?.runs ?? []).map((run) => ({
    x: run.parameter_value,
    y: run.peak_split_risk,
    label: run.parameter_value.toFixed(2)
  }));
  return <ScatterSvg points={points} />;
}

export function CounterfactualChart({ result, metric }: { result?: CounterfactualResult; metric: ExperimentMetricKey }) {
  if (!result) return <div className="chartEmpty">Run a counterfactual to draw branch histories.</div>;
  const original = result.original.timeline.map((item) => ({ x: item.year, y: metricValue(item, metric) }));
  const counter = result.counterfactual.timeline.map((item) => ({ x: item.year, y: metricValue(item, metric) }));
  return <MultiLineSvg original={original} counter={counter} metric={metric} />;
}

export function MonteCarloIntervalChart({ result }: { result?: MonteCarloResult }) {
  if (!result) return <div className="chartEmpty">Run Monte Carlo to draw confidence intervals.</div>;
  const stats: Array<{ label: string; stats: MetricStats; percent: boolean }> = [
    { label: "split", stats: result.summary.split_risk, percent: true },
    { label: "control", stats: result.summary.central_control, percent: true },
    { label: "escalation", stats: result.summary.escalation_risk, percent: true },
    { label: "trade", stats: result.summary.trade_throughput, percent: false }
  ];
  const width = 720;
  const height = 300;
  const pad = 42;
  const maxValue = Math.max(...stats.map((item) => item.stats.ci95_high), 0.1);
  const mapX = (value: number) => pad + (value / maxValue) * (width - pad * 2);
  const rowY = (index: number) => pad + index * 58;
  return (
    <svg className="experimentChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="monte carlo confidence interval chart">
      <path d={`M ${pad} ${height - pad} H ${width - pad}`} className="axisLine" />
      {stats.map((item, index) => {
        const y = rowY(index);
        return (
          <g key={item.label}>
            <text x={pad} y={y - 12}>{item.label}</text>
            <line x1={mapX(item.stats.ci95_low)} x2={mapX(item.stats.ci95_high)} y1={y} y2={y} className="intervalLine" />
            <circle cx={mapX(item.stats.mean)} cy={y} r="7" className="chartPoint" />
            <text x={mapX(item.stats.mean) + 12} y={y + 4}>
              {item.percent ? percent(item.stats.mean) : item.stats.mean.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SensitivityBarChart({ result }: { result?: SensitivityResult }) {
  if (!result) return <div className="chartEmpty">Run sensitivity analysis to draw parameter scores.</div>;
  const width = 720;
  const height = 320;
  const pad = 46;
  const rows = result.results;
  const maxScore = Math.max(...rows.map((item) => item.sensitivity_score), 0.01);
  const barHeight = 34;
  const rowGap = 28;
  const mapWidth = (value: number) => (value / maxScore) * (width - pad * 2 - 100);
  return (
    <svg className="experimentChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="sensitivity score bar chart">
      <path d={`M ${pad} ${height - pad} H ${width - pad}`} className="axisLine" />
      {rows.map((item, index) => {
        const y = pad + index * (barHeight + rowGap);
        const w = mapWidth(item.sensitivity_score);
        return (
          <g key={item.parameter}>
            <text x={pad} y={y - 8}>{item.parameter}</text>
            <rect x={pad} y={y} width={w} height={barHeight} rx="5" className="sensitivityBar" />
            <circle cx={pad + w + 18} cy={y + barHeight / 2} r="6" className={item.split_risk_delta >= 0 ? "riskDot" : "stableDot"} />
            <text x={pad + w + 34} y={y + 22}>
              {item.sensitivity_score.toFixed(2)} / {item.confidence}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineSvg({ points, formatY }: { points: Array<{ x: number; y: number }>; formatY: (value: number) => string }) {
  const width = 620;
  const height = 260;
  const pad = 34;
  if (points.length === 0) return <div className="chartEmpty">Run a sweep to draw the curve.</div>;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(...ys, 0.1);
  const mapX = (value: number) => pad + ((value - minX) / Math.max(0.001, maxX - minX)) * (width - pad * 2);
  const mapY = (value: number) => height - pad - ((value - minY) / Math.max(0.001, maxY - minY)) * (height - pad * 2);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${mapX(point.x)} ${mapY(point.y)}`).join(" ");
  return (
    <svg className="experimentChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="sweep metric line chart">
      <path d={`M ${pad} ${height - pad} H ${width - pad} M ${pad} ${pad} V ${height - pad}`} className="axisLine" />
      <path d={path} className="chartLine" />
      {points.map((point) => (
        <g key={`${point.x}-${point.y}`}>
          <circle cx={mapX(point.x)} cy={mapY(point.y)} r="5" className="chartPoint" />
          <text x={mapX(point.x)} y={height - 10} textAnchor="middle">{point.x.toFixed(2)}</text>
        </g>
      ))}
      <text x={pad} y={22}>{formatY(maxY)}</text>
      <text x={pad} y={height - 8}>{formatY(minY)}</text>
    </svg>
  );
}

export function MultiLineSvg({ original, counter, metric }: { original: Array<{ x: number; y: number }>; counter: Array<{ x: number; y: number }>; metric: ExperimentMetricKey }) {
  const width = 720;
  const height = 300;
  const pad = 38;
  const all = [...original, ...counter];
  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const minY = Math.min(0, ...all.map((point) => point.y));
  const maxY = Math.max(...all.map((point) => point.y), 0.1);
  const mapX = (value: number) => pad + ((value - minX) / Math.max(0.001, maxX - minX)) * (width - pad * 2);
  const mapY = (value: number) => height - pad - ((value - minY) / Math.max(0.001, maxY - minY)) * (height - pad * 2);
  const toPath = (points: Array<{ x: number; y: number }>) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${mapX(point.x)} ${mapY(point.y)}`).join(" ");
  const formatY = (value: number) => (metric === "trade_throughput" ? value.toFixed(1) : `${Math.round(value * 100)}%`);
  return (
    <svg className="experimentChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="counterfactual branch chart">
      <path d={`M ${pad} ${height - pad} H ${width - pad} M ${pad} ${pad} V ${height - pad}`} className="axisLine" />
      <path d={toPath(original)} className="chartLine originalLine" />
      <path d={toPath(counter)} className="chartLine counterLine" />
      <text x={pad} y={22}>{formatY(maxY)}</text>
      <text x={pad} y={height - 8}>{formatY(minY)}</text>
      <text x={width - pad} y={22} textAnchor="end">original / counterfactual</text>
      <circle cx={width - 180} cy={height - 14} r="5" className="legendOriginal" />
      <text x={width - 168} y={height - 10}>original</text>
      <circle cx={width - 92} cy={height - 14} r="5" className="legendCounter" />
      <text x={width - 80} y={height - 10}>counter</text>
    </svg>
  );
}

export function ScatterSvg({ points }: { points: Array<{ x: number; y: number; label: string }> }) {
  const width = 620;
  const height = 260;
  const pad = 34;
  if (points.length === 0) return <div className="chartEmpty">Run a sweep to draw the scatter plot.</div>;
  const xs = points.map((point) => point.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...points.map((point) => point.y), 0.1);
  const mapX = (value: number) => pad + ((value - minX) / Math.max(0.001, maxX - minX)) * (width - pad * 2);
  const mapY = (value: number) => height - pad - (value / maxY) * (height - pad * 2);
  return (
    <svg className="experimentChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="central control vs split risk scatter plot">
      <path d={`M ${pad} ${height - pad} H ${width - pad} M ${pad} ${pad} V ${height - pad}`} className="axisLine" />
      <text x={width - pad} y={height - 8} textAnchor="end">parameter value</text>
      <text x={pad} y={22}>split risk</text>
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={mapX(point.x)} cy={mapY(point.y)} r="6" className="scatterPoint" />
          <text x={mapX(point.x) + 9} y={mapY(point.y) + 4}>{point.label}</text>
        </g>
      ))}
    </svg>
  );
}
