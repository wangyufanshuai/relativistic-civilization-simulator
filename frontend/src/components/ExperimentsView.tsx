import React from "react";
import { BarChart3, Clipboard, Download, FileText, FlaskConical, GitCompareArrows, LineChart, SlidersHorizontal } from "lucide-react";
import { compareScenarios, experimentReport, runCounterfactual, runMonteCarlo, runSimulation, runSweep } from "../lib/api";
import type {
  CounterfactualResult,
  ExperimentMetricKey,
  MetricStats,
  MonteCarloResult,
  Metric,
  RiskBreakdown,
  Scenario,
  ScenarioCompareResult,
  SweepParameter,
  SweepResult
} from "../types/sim";

const parameterDefaults: Record<SweepParameter, number[]> = {
  centralization: [0.15, 0.3, 0.45, 0.6, 0.75, 0.9],
  ship_velocity_c: [0.18, 0.3, 0.45, 0.6, 0.78, 0.92],
  expansion_pressure: [0.18, 0.32, 0.46, 0.6, 0.74, 0.88],
  federation_bias: [0, 0.18, 0.36, 0.54, 0.72, 0.9]
};

const metricLabels: Record<ExperimentMetricKey, string> = {
  split_risk: "split risk",
  central_control: "central control",
  war_tension: "war tension",
  trade_throughput: "trade throughput",
  escalation_risk: "escalation risk",
  deterrence_stability: "deterrence stability"
};

const riskFactorLabels: Array<[keyof RiskBreakdown, string]> = [
  ["command_pressure", "command"],
  ["delay_pressure", "delay"],
  ["unresolved_autonomy", "autonomy"],
  ["loyalty_loss", "loyalty"]
];

const experimentPresets: Array<{
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

interface ExperimentsViewProps {
  scenarios: Scenario[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
}

export function ExperimentsView({ scenarios, busy, setBusy, setStatus }: ExperimentsViewProps) {
  const [mode, setMode] = React.useState<"sweep" | "counterfactual" | "monteCarlo">("sweep");
  const [scenario, setScenario] = React.useState("baseline_empire");
  const [parameter, setParameter] = React.useState<SweepParameter>("centralization");
  const [metric, setMetric] = React.useState<ExperimentMetricKey>("split_risk");
  const [sweepValues, setSweepValues] = React.useState<number[]>(parameterDefaults.centralization);
  const [sweep, setSweep] = React.useState<SweepResult>();
  const [comparison, setComparison] = React.useState<ScenarioCompareResult[]>([]);
  const [forkYear, setForkYear] = React.useState(40);
  const [counterSteps, setCounterSteps] = React.useState(60);
  const [counterCentralization, setCounterCentralization] = React.useState(0.24);
  const [counterVelocity, setCounterVelocity] = React.useState(0.45);
  const [counterfactual, setCounterfactual] = React.useState<CounterfactualResult>();
  const [reportText, setReportText] = React.useState("");
  const [sweepReportText, setSweepReportText] = React.useState("");
  const [monteCarlo, setMonteCarlo] = React.useState<MonteCarloResult>();
  const [monteSteps, setMonteSteps] = React.useState(120);
  const [seedStart, setSeedStart] = React.useState(100);
  const [seedCount, setSeedCount] = React.useState(20);

  React.useEffect(() => {
    void handleRunSweep();
    void handleCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runExperimentTask<T>(message: string, task: () => Promise<T>): Promise<T> {
    setBusy(true);
    setStatus(message);
    try {
      const result = await task();
      setStatus("experiment bench ready");
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function handleRunSweep() {
    const result = await runExperimentTask(`sweeping ${parameter}`, () =>
      runSweep(scenario, parameter, sweepValues, 140, 42)
    );
    setSweep(result);
  }

  async function handleCompare() {
    const result = await runExperimentTask("comparing scenarios", () => compareScenarios(100, 42));
    setComparison(result);
  }

  async function handleCounterfactual() {
    const result = await runExperimentTask("running counterfactual", async () => {
      const base = await runSimulation(scenario, Math.max(forkYear, 80), 42);
      return runCounterfactual(base.run_id, forkYear, counterSteps, {
        centralization: counterCentralization,
        ship_velocity_c: counterVelocity
      });
    });
    setCounterfactual(result);
    setReportText("");
  }

  async function handleReport() {
    if (!counterfactual) return;
    const result = await runExperimentTask("generating report", () => experimentReport("counterfactual", counterfactual));
    setReportText(result.markdown);
  }

  async function handleSweepReport() {
    if (!sweep) return;
    const result = await runExperimentTask("generating sweep report", () => experimentReport("sweep", sweep));
    setSweepReportText(result.markdown);
  }

  async function handleMonteCarlo() {
    const seeds = Array.from({ length: Math.max(3, seedCount) }, (_, index) => seedStart + index);
    const result = await runExperimentTask("running monte carlo", () => runMonteCarlo(scenario, seeds, monteSteps));
    setMonteCarlo(result);
  }

  function handleParameterChange(next: SweepParameter) {
    setParameter(next);
    setSweepValues(parameterDefaults[next]);
    setSweep(undefined);
    setSweepReportText("");
  }

  function handlePreset(id: string) {
    const preset = experimentPresets.find((item) => item.id === id);
    if (!preset) return;
    setScenario(preset.scenario);
    setParameter(preset.parameter);
    setMetric(preset.metric);
    setSweepValues(preset.values);
    setSweep(undefined);
    setSweepReportText("");
    setMode("sweep");
  }

  const ranked = [...(sweep?.runs ?? [])].sort((a, b) => b.peak_split_risk - a.peak_split_risk);
  const riskiest = ranked[0];
  const selectedScenario = scenarios.find((item) => item.id === scenario);

  return (
    <section className="experimentShell">
      <div className="experimentHero">
        <div>
          <span>v0.8 monte carlo research lab</span>
          <h2>Which intervention changes imperial history?</h2>
          <p>
            Compare parameter sweeps, then fork a historical snapshot and test whether a different governance policy
            reduces relativistic split pressure.
          </p>
        </div>
        <div className="modeSwitch" role="tablist" aria-label="experiment mode">
          <button className={mode === "sweep" ? "active" : ""} onClick={() => setMode("sweep")}>
            Sweep
          </button>
          <button className={mode === "counterfactual" ? "active" : ""} onClick={() => setMode("counterfactual")}>
            Counterfactual
          </button>
          <button className={mode === "monteCarlo" ? "active" : ""} onClick={() => setMode("monteCarlo")}>
            Monte Carlo
          </button>
        </div>
      </div>

      {mode === "sweep" ? (
        <SweepWorkspace
          busy={busy}
          scenario={scenario}
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          parameter={parameter}
          metric={metric}
          sweep={sweep}
          comparison={comparison}
          ranked={ranked}
          riskiest={riskiest}
          setScenario={setScenario}
          setMetric={setMetric}
          handleParameterChange={handleParameterChange}
          handleRunSweep={handleRunSweep}
          handleCompare={handleCompare}
          handlePreset={handlePreset}
          handleSweepReport={handleSweepReport}
          reportText={sweepReportText}
        />
      ) : mode === "counterfactual" ? (
        <CounterfactualWorkspace
          busy={busy}
          scenario={scenario}
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          metric={metric}
          forkYear={forkYear}
          counterSteps={counterSteps}
          counterCentralization={counterCentralization}
          counterVelocity={counterVelocity}
          result={counterfactual}
          reportText={reportText}
          setScenario={setScenario}
          setMetric={setMetric}
          setForkYear={setForkYear}
          setCounterSteps={setCounterSteps}
          setCounterCentralization={setCounterCentralization}
          setCounterVelocity={setCounterVelocity}
          handleCounterfactual={handleCounterfactual}
          handleReport={handleReport}
        />
      ) : (
        <MonteCarloWorkspace
          busy={busy}
          scenario={scenario}
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          steps={monteSteps}
          seedStart={seedStart}
          seedCount={seedCount}
          result={monteCarlo}
          setScenario={setScenario}
          setSteps={setMonteSteps}
          setSeedStart={setSeedStart}
          setSeedCount={setSeedCount}
          handleRun={handleMonteCarlo}
        />
      )}
    </section>
  );
}

function MonteCarloWorkspace(props: {
  busy: boolean;
  scenario: string;
  scenarios: Scenario[];
  selectedScenario?: Scenario;
  steps: number;
  seedStart: number;
  seedCount: number;
  result?: MonteCarloResult;
  setScenario: (value: string) => void;
  setSteps: (value: number) => void;
  setSeedStart: (value: number) => void;
  setSeedCount: (value: number) => void;
  handleRun: () => void;
}) {
  return (
    <>
      <div className="counterGrid">
        <section className="panel experimentControls">
          <div className="panelHeader">
            <span>monte carlo controls</span>
            <SlidersHorizontal size={16} />
          </div>
          <ScenarioSelect scenarios={props.scenarios} scenario={props.scenario} setScenario={props.setScenario} busy={props.busy} />
          <NumberControl label="Steps" value={props.steps} min={20} max={400} step={10} onChange={props.setSteps} />
          <NumberControl label="Seed start" value={props.seedStart} min={1} max={10000} step={1} onChange={props.setSeedStart} />
          <NumberControl label="Seed count" value={props.seedCount} min={3} max={100} step={1} onChange={props.setSeedCount} />
          <p className="scenarioCopy">{props.selectedScenario?.description}</p>
          <button className="primary" onClick={props.handleRun} disabled={props.busy}>
            <FlaskConical size={16} />
            Run Monte Carlo
          </button>
        </section>

        <section className="panel chartPanel counterChartPanel">
          <div className="panelHeader">
            <span>confidence intervals</span>
            <BarChart3 size={16} />
          </div>
          <MonteCarloIntervalChart result={props.result} />
        </section>

        <section className="panel conclusionPanel counterSummary">
          <div className="panelHeader">
            <span>research summary</span>
            <strong>{props.result ? `${props.result.runs.length} seeds` : "idle"}</strong>
          </div>
          {props.result ? (
            <>
              <strong>{props.result.summary.interpretation}</strong>
              <dl className="readoutGrid">
                <Readout label="split probability" value={`${Math.round(props.result.summary.split_probability * 100)}%`} />
                <Readout label="split risk mean" value={`${Math.round(props.result.summary.split_risk.mean * 100)}%`} />
                <Readout label="escalation mean" value={`${Math.round(props.result.summary.escalation_risk.mean * 100)}%`} />
                <Readout label="first split mean" value={props.result.summary.first_split_year_mean ?? "none"} />
              </dl>
            </>
          ) : (
            <p className="empty">Run multiple deterministic seeds to estimate stability ranges and confidence intervals.</p>
          )}
        </section>
      </div>

      <section className="panel resultsPanel">
        <div className="panelHeader">
          <span>seed outcomes</span>
          <strong>{props.result?.scenario ?? "--"}</strong>
        </div>
        <MonteCarloTable result={props.result} />
      </section>
    </>
  );
}

function SweepWorkspace(props: {
  busy: boolean;
  scenario: string;
  scenarios: Scenario[];
  selectedScenario?: Scenario;
  parameter: SweepParameter;
  metric: ExperimentMetricKey;
  sweep?: SweepResult;
  comparison: ScenarioCompareResult[];
  ranked: SweepResult["runs"];
  riskiest?: SweepResult["runs"][number];
  setScenario: (value: string) => void;
  setMetric: (value: ExperimentMetricKey) => void;
  handleParameterChange: (value: SweepParameter) => void;
  handleRunSweep: () => void;
  handleCompare: () => void;
  handlePreset: (id: string) => void;
  handleSweepReport: () => void;
  reportText: string;
}) {
  return (
    <>
      <div className="experimentGrid">
        <section className="panel experimentControls">
          <div className="panelHeader">
            <span>sweep controls</span>
            <SlidersHorizontal size={16} />
          </div>
          <ScenarioSelect scenarios={props.scenarios} scenario={props.scenario} setScenario={props.setScenario} busy={props.busy} />
          <label>
            Parameter
            <select value={props.parameter} onChange={(event) => props.handleParameterChange(event.target.value as SweepParameter)} disabled={props.busy}>
              {Object.keys(parameterDefaults).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <MetricSelect metric={props.metric} setMetric={props.setMetric} busy={props.busy} />
          <p className="scenarioCopy">{props.selectedScenario?.description}</p>
          <div className="presetGrid">
            {experimentPresets.map((preset) => (
              <button key={preset.id} onClick={() => props.handlePreset(preset.id)} disabled={props.busy}>
                {preset.label}
              </button>
            ))}
          </div>
          <button className="primary" onClick={props.handleRunSweep} disabled={props.busy}>
            <FlaskConical size={16} />
            Run sweep
          </button>
          <button onClick={props.handleCompare} disabled={props.busy}>
            <GitCompareArrows size={16} />
            Compare scenarios
          </button>
          <button onClick={props.handleSweepReport} disabled={props.busy || !props.sweep}>
            <FileText size={16} />
            Generate sweep report
          </button>
        </section>

        <section className="panel chartPanel">
          <div className="panelHeader">
            <span>{metricLabels[props.metric]} curve</span>
            <LineChart size={16} />
          </div>
          <SweepChart result={props.sweep} metric={props.metric} />
        </section>

        <section className="panel chartPanel">
          <div className="panelHeader">
            <span>risk scatter</span>
            <BarChart3 size={16} />
          </div>
          <ScatterChart result={props.sweep} />
        </section>

        <section className="panel conclusionPanel">
          <div className="panelHeader">
            <span>rule summary</span>
            <strong>{props.sweep ? `${props.sweep.runs.length} runs` : "idle"}</strong>
          </div>
          {props.sweep ? (
            <>
              <strong>{props.sweep.summary.dominant_trend}</strong>
              <p>{props.sweep.summary.recommendation}</p>
              <dl className="readoutGrid">
                <Readout label="stable value" value={props.sweep.summary.best_stability_value.toFixed(2)} />
                <Readout label="risk value" value={props.sweep.summary.highest_split_risk_value.toFixed(2)} />
              </dl>
              {props.riskiest && <PeakBreakdown breakdown={props.riskiest.peak_risk_breakdown} />}
            </>
          ) : (
            <p className="empty">Run a sweep to generate a deterministic research summary.</p>
          )}
        </section>
      </div>
      <SweepTables ranked={props.ranked} comparison={props.comparison} parameter={props.parameter} />
      {props.reportText && <MarkdownReport markdown={props.reportText} filename="sweep-report.md" />}
    </>
  );
}

function CounterfactualWorkspace(props: {
  busy: boolean;
  scenario: string;
  scenarios: Scenario[];
  selectedScenario?: Scenario;
  metric: ExperimentMetricKey;
  forkYear: number;
  counterSteps: number;
  counterCentralization: number;
  counterVelocity: number;
  result?: CounterfactualResult;
  reportText: string;
  setScenario: (value: string) => void;
  setMetric: (value: ExperimentMetricKey) => void;
  setForkYear: (value: number) => void;
  setCounterSteps: (value: number) => void;
  setCounterCentralization: (value: number) => void;
  setCounterVelocity: (value: number) => void;
  handleCounterfactual: () => void;
  handleReport: () => void;
}) {
  return (
    <>
      <div className="counterGrid">
        <section className="panel experimentControls">
          <div className="panelHeader">
            <span>counterfactual controls</span>
            <SlidersHorizontal size={16} />
          </div>
          <ScenarioSelect scenarios={props.scenarios} scenario={props.scenario} setScenario={props.setScenario} busy={props.busy} />
          <MetricSelect metric={props.metric} setMetric={props.setMetric} busy={props.busy} />
          <NumberControl label="Fork year" value={props.forkYear} min={5} max={140} step={5} onChange={props.setForkYear} />
          <NumberControl label="Continue years" value={props.counterSteps} min={10} max={200} step={10} onChange={props.setCounterSteps} />
          <NumberControl label="Counter centralization" value={props.counterCentralization} min={0} max={1} step={0.02} onChange={props.setCounterCentralization} />
          <NumberControl label="Counter ship velocity" value={props.counterVelocity} min={0.08} max={0.98} step={0.01} onChange={props.setCounterVelocity} />
          <p className="scenarioCopy">{props.selectedScenario?.description}</p>
          <button className="primary" onClick={props.handleCounterfactual} disabled={props.busy}>
            <FlaskConical size={16} />
            Run counterfactual
          </button>
          <button onClick={props.handleReport} disabled={props.busy || !props.result}>
            <FileText size={16} />
            Generate report
          </button>
        </section>

        <section className="panel chartPanel counterChartPanel">
          <div className="panelHeader">
            <span>original vs counterfactual {metricLabels[props.metric]}</span>
            <LineChart size={16} />
          </div>
          <CounterfactualChart result={props.result} metric={props.metric} />
        </section>

        <section className="panel conclusionPanel counterSummary">
          <div className="panelHeader">
            <span>causal summary</span>
            <strong>{props.result ? `fork y${props.result.snapshot_year}` : "idle"}</strong>
          </div>
          {props.result ? (
            <>
              <strong>{props.result.summary}</strong>
              <dl className="readoutGrid">
                <Readout label="split risk delta" value={formatDelta(props.result.delta.split_risk_delta)} />
                <Readout label="control delta" value={formatDelta(props.result.delta.central_control_delta)} />
                <Readout label="peak risk delta" value={formatDelta(props.result.delta.peak_split_risk_delta)} />
                <Readout label="first split delta" value={props.result.delta.first_split_year_delta ?? "none"} />
                <Readout label="escalation delta" value={formatDelta(props.result.delta.escalation_risk_delta)} />
                <Readout label="deterrence delta" value={formatDelta(props.result.delta.deterrence_stability_delta)} />
              </dl>
              <PeakBreakdown breakdown={props.result.counterfactual.final_metrics.risk_breakdown} />
            </>
          ) : (
            <p className="empty">Run a baseline history, fork a snapshot, and compare the intervention.</p>
          )}
        </section>
      </div>

      <section className="panel resultsPanel">
        <div className="panelHeader">
          <span>branch comparison</span>
          <strong>{props.result ? props.result.fork_run_id : "--"}</strong>
        </div>
        <BranchComparison result={props.result} />
      </section>

      {props.reportText && <MarkdownReport markdown={props.reportText} filename="counterfactual-report.md" />}
    </>
  );
}

function MarkdownReport({ markdown, filename }: { markdown: string; filename: string }) {
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

function ScenarioSelect({ scenarios, scenario, setScenario, busy }: { scenarios: Scenario[]; scenario: string; setScenario: (value: string) => void; busy: boolean }) {
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

function MetricSelect({ metric, setMetric, busy }: { metric: ExperimentMetricKey; setMetric: (value: ExperimentMetricKey) => void; busy: boolean }) {
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

function NumberControl(props: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
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

function SweepTables({ ranked, comparison, parameter }: { ranked: SweepResult["runs"]; comparison: ScenarioCompareResult[]; parameter: SweepParameter }) {
  return (
    <>
      <section className="panel resultsPanel">
        <div className="panelHeader">
          <span>sweep ranking</span>
          <strong>{parameter}</strong>
        </div>
        <div className="resultsTable">
          <div className="tableHeader">
            <span>value</span>
            <span>peak split</span>
            <span>first split</span>
            <span>max polities</span>
            <span>avg trade</span>
            <span>final control</span>
          </div>
          {ranked.map((run) => (
            <div className="tableRow" key={run.parameter_value}>
              <strong>{run.parameter_value.toFixed(2)}</strong>
              <span>{Math.round(run.peak_split_risk * 100)}%</span>
              <span>{run.year_of_first_split ?? "none"}</span>
              <span>{run.max_polities}</span>
              <span>{run.average_trade_throughput.toFixed(1)}</span>
              <span>{Math.round(run.final_metrics.central_control * 100)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel resultsPanel">
        <div className="panelHeader">
          <span>scenario comparison</span>
          <strong>{comparison.length || "--"}</strong>
        </div>
        <div className="scenarioCompareGrid">
          {comparison.map((item) => (
            <article key={item.scenario} className="compareCard">
              <strong>{item.scenario}</strong>
              <span>split {Math.round(item.split_risk * 100)}%</span>
              <span>control {Math.round(item.central_control * 100)}%</span>
              <span>trade {item.trade_throughput.toFixed(1)}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function BranchComparison({ result }: { result?: CounterfactualResult }) {
  if (!result) return <div className="chartEmpty">Run a counterfactual to compare branches.</div>;
  const rows = [
    ["final split", percent(result.original.final_metrics.split_risk), percent(result.counterfactual.final_metrics.split_risk)],
    ["central control", percent(result.original.final_metrics.central_control), percent(result.counterfactual.final_metrics.central_control)],
    ["escalation risk", percent(result.original.final_metrics.cold_war.escalation_risk), percent(result.counterfactual.final_metrics.cold_war.escalation_risk)],
    ["deterrence", percent(result.original.final_metrics.cold_war.deterrence_stability), percent(result.counterfactual.final_metrics.cold_war.deterrence_stability)],
    ["first split", result.original.year_of_first_split ?? "none", result.counterfactual.year_of_first_split ?? "none"],
    ["peak split", percent(result.original.peak_split_risk), percent(result.counterfactual.peak_split_risk)],
    ["dominant risk", result.delta.dominant_risk_factor_before, result.delta.dominant_risk_factor_after]
  ];
  return (
    <div className="resultsTable">
      <div className="tableHeader branchHeader">
        <span>metric</span>
        <span>original</span>
        <span>counterfactual</span>
      </div>
      {rows.map(([label, original, counter]) => (
        <div className="tableRow branchRow" key={label}>
          <strong>{label}</strong>
          <span>{original}</span>
          <span>{counter}</span>
        </div>
      ))}
    </div>
  );
}

function MonteCarloTable({ result }: { result?: MonteCarloResult }) {
  if (!result) return <div className="chartEmpty">Run Monte Carlo to list seed outcomes.</div>;
  return (
    <div className="resultsTable">
      <div className="tableHeader">
        <span>seed</span>
        <span>split risk</span>
        <span>control</span>
        <span>escalation</span>
        <span>first split</span>
        <span>max polities</span>
      </div>
      {result.runs.map((run) => (
        <div className="tableRow" key={run.seed}>
          <strong>{run.seed}</strong>
          <span>{percent(run.final_metrics.split_risk)}</span>
          <span>{percent(run.final_metrics.central_control)}</span>
          <span>{percent(run.final_metrics.cold_war.escalation_risk)}</span>
          <span>{run.year_of_first_split ?? "none"}</span>
          <span>{run.max_polities}</span>
        </div>
      ))}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PeakBreakdown({ breakdown }: { breakdown: RiskBreakdown }) {
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

function SweepChart({ result, metric }: { result?: SweepResult; metric: ExperimentMetricKey }) {
  const points = (result?.runs ?? []).map((run) => ({
    x: run.parameter_value,
    y: metricValue(run.final_metrics, metric)
  }));
  return <LineSvg points={points} formatY={(value) => (metric === "trade_throughput" ? value.toFixed(1) : `${Math.round(value * 100)}%`)} />;
}

function ScatterChart({ result }: { result?: SweepResult }) {
  const points = (result?.runs ?? []).map((run) => ({
    x: run.parameter_value,
    y: run.peak_split_risk,
    label: run.parameter_value.toFixed(2)
  }));
  return <ScatterSvg points={points} />;
}

function CounterfactualChart({ result, metric }: { result?: CounterfactualResult; metric: ExperimentMetricKey }) {
  if (!result) return <div className="chartEmpty">Run a counterfactual to draw branch histories.</div>;
  const original = result.original.timeline.map((item) => ({ x: item.year, y: metricValue(item, metric) }));
  const counter = result.counterfactual.timeline.map((item) => ({ x: item.year, y: metricValue(item, metric) }));
  return <MultiLineSvg original={original} counter={counter} metric={metric} />;
}

function MonteCarloIntervalChart({ result }: { result?: MonteCarloResult }) {
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

function LineSvg({ points, formatY }: { points: Array<{ x: number; y: number }>; formatY: (value: number) => string }) {
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

function MultiLineSvg({ original, counter, metric }: { original: Array<{ x: number; y: number }>; counter: Array<{ x: number; y: number }>; metric: ExperimentMetricKey }) {
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

function ScatterSvg({ points }: { points: Array<{ x: number; y: number; label: string }> }) {
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

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDelta(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 100)}%`;
}

function metricValue(metric: Metric, key: ExperimentMetricKey) {
  if (key === "escalation_risk") return metric.cold_war.escalation_risk;
  if (key === "deterrence_stability") return metric.cold_war.deterrence_stability;
  return Number(metric[key]);
}

function downloadMarkdown(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
