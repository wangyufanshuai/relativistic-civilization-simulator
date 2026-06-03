import React from "react";
import { Clipboard, Download, FileText } from "lucide-react";
import type { ExperimentMetricKey, RiskBreakdown, Scenario } from "../../types/sim";
import { metricLabels, riskFactorLabels } from "./constants";
import { downloadMarkdown } from "./utils";

export function MarkdownReport({ markdown, filename }: { markdown: string; filename: string }) {
  return (
    <section className="panel reportPanel">
      <div className="panelHeader">
        <span>markdown report</span>
        <div className="reportActions">
          <button onClick={() => downloadMarkdown(markdown, filename)} aria-label="Download report">
            <Download size={15} />
          </button>
          <button onClick={() => void navigator.clipboard?.writeText(markdown)} aria-label="Copy report">
            <Clipboard size={15} />
          </button>
          <FileText size={16} />
        </div>
      </div>
      <pre>{markdown}</pre>
    </section>
  );
}

export function ScenarioSelect({ scenarios, scenario, setScenario, busy }: { scenarios: Scenario[]; scenario: string; setScenario: (value: string) => void; busy: boolean }) {
  return (
    <label>
      Scenario
      <select value={scenario} onChange={(event) => setScenario(event.target.value)} disabled={busy}>
        {scenarios.map((item) => (
          <option key={item.id} value={item.id}>
            {item.id}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MetricSelect({ metric, setMetric, busy }: { metric: ExperimentMetricKey; setMetric: (value: ExperimentMetricKey) => void; busy: boolean }) {
  return (
    <label>
      Metric
      <select value={metric} onChange={(event) => setMetric(event.target.value as ExperimentMetricKey)} disabled={busy}>
        {Object.entries(metricLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NumberControl(props: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label>
      {props.label}
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function Readout({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PeakBreakdown({ breakdown }: { breakdown: RiskBreakdown }) {
  return (
    <div className="peakBreakdown">
      {riskFactorLabels.map(([key, label]) => (
        <span key={key}>
          {label} <strong>{Math.round(Number(breakdown[key]) * 100)}%</strong>
        </span>
      ))}
    </div>
  );
}
