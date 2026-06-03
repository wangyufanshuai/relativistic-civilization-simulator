import { BarChart3, FileText, FlaskConical, GitCompareArrows, LineChart, Microscope, SlidersHorizontal } from "lucide-react";
import type {
  Assumption,
  CredibilityAudit,
  CounterfactualResult,
  ExperimentMetricKey,
  MonteCarloResult,
  ResearchAuditKind,
  Scenario,
  ScenarioCompareResult,
  SensitivityResult,
  SweepParameter,
  SweepResult
} from "../../types/sim";
import { experimentPresets, metricLabels, parameterDefaults } from "./constants";
import { CounterfactualChart, MonteCarloIntervalChart, ScatterChart, SensitivityBarChart, SweepChart } from "./charts";
import { MarkdownReport, MetricSelect, NumberControl, PeakBreakdown, Readout, ScenarioSelect } from "./controls";
import { BranchComparison, MonteCarloTable, SensitivityTable, SweepTables } from "./tables";
import { formatDelta } from "./utils";

export function MonteCarloWorkspace(props: {
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
  useForAudit: () => void;
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
          <button onClick={props.useForAudit} disabled={props.busy || !props.result}>
            <Microscope size={16} />
            Use for credibility audit
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

export function SensitivityWorkspace(props: {
  busy: boolean;
  scenario: string;
  scenarios: Scenario[];
  selectedScenario?: Scenario;
  steps: number;
  seedStart: number;
  seedCount: number;
  perturbation: number;
  result?: SensitivityResult;
  reportText: string;
  setScenario: (value: string) => void;
  setSteps: (value: number) => void;
  setSeedStart: (value: number) => void;
  setSeedCount: (value: number) => void;
  setPerturbation: (value: number) => void;
  handleRun: () => void;
  handleReport: () => void;
  useForAudit: () => void;
}) {
  return (
    <>
      <div className="counterGrid">
        <section className="panel experimentControls">
          <div className="panelHeader">
            <span>sensitivity controls</span>
            <SlidersHorizontal size={16} />
          </div>
          <ScenarioSelect scenarios={props.scenarios} scenario={props.scenario} setScenario={props.setScenario} busy={props.busy} />
          <NumberControl label="Steps" value={props.steps} min={20} max={400} step={10} onChange={props.setSteps} />
          <NumberControl label="Seed start" value={props.seedStart} min={1} max={10000} step={1} onChange={props.setSeedStart} />
          <NumberControl label="Seed count" value={props.seedCount} min={3} max={50} step={1} onChange={props.setSeedCount} />
          <NumberControl label="Perturbation" value={props.perturbation} min={0.05} max={0.45} step={0.01} onChange={props.setPerturbation} />
          <p className="scenarioCopy">{props.selectedScenario?.description}</p>
          <button className="primary" onClick={props.handleRun} disabled={props.busy}>
            <FlaskConical size={16} />
            Run sensitivity
          </button>
          <button onClick={props.handleReport} disabled={props.busy || !props.result}>
            <FileText size={16} />
            Generate sensitivity report
          </button>
          <button onClick={props.useForAudit} disabled={props.busy || !props.result}>
            <Microscope size={16} />
            Use for credibility audit
          </button>
        </section>

        <section className="panel chartPanel counterChartPanel">
          <div className="panelHeader">
            <span>parameter sensitivity score</span>
            <BarChart3 size={16} />
          </div>
          <SensitivityBarChart result={props.result} />
        </section>

        <section className="panel conclusionPanel counterSummary">
          <div className="panelHeader">
            <span>credibility summary</span>
            <strong>{props.result ? `${props.result.seeds.length} seeds` : "idle"}</strong>
          </div>
          {props.result ? (
            <>
              <strong>{props.result.summary.dominant_effect}</strong>
              <p>{props.result.summary.recommendation}</p>
              <dl className="readoutGrid">
                <Readout label="strongest parameter" value={props.result.summary.strongest_parameter} />
                <Readout label="top confidence" value={props.result.results[0]?.confidence ?? "--"} />
                <Readout label="top split delta" value={formatDelta(props.result.results[0]?.split_risk_delta ?? 0)} />
                <Readout label="top escalation delta" value={formatDelta(props.result.results[0]?.escalation_risk_delta ?? 0)} />
              </dl>
            </>
          ) : (
            <p className="empty">Run a local perturbation scan to identify which model assumptions most affect conclusions.</p>
          )}
        </section>
      </div>

      <section className="panel resultsPanel">
        <div className="panelHeader">
          <span>sensitivity ranking</span>
          <strong>{props.result?.scenario ?? "--"}</strong>
        </div>
        <SensitivityTable result={props.result} />
      </section>

      {props.reportText && <MarkdownReport markdown={props.reportText} filename="sensitivity-report.md" />}
    </>
  );
}

export function CredibilityWorkspace(props: {
  busy: boolean;
  scenario: string;
  scenarios: Scenario[];
  selectedScenario?: Scenario;
  assumptions: Assumption[];
  auditKind: ResearchAuditKind;
  audit?: CredibilityAudit;
  setScenario: (value: string) => void;
  setAuditKind: (value: ResearchAuditKind) => void;
  handleAudit: () => void;
}) {
  return (
    <>
      <div className="counterGrid">
        <section className="panel experimentControls">
          <div className="panelHeader">
            <span>credibility controls</span>
            <SlidersHorizontal size={16} />
          </div>
          <ScenarioSelect scenarios={props.scenarios} scenario={props.scenario} setScenario={props.setScenario} busy={props.busy} />
          <label>
            Evidence source
            <select value={props.auditKind} onChange={(event) => props.setAuditKind(event.target.value as ResearchAuditKind)} disabled={props.busy}>
              <option value="run">single run</option>
              <option value="sweep">latest sweep</option>
              <option value="counterfactual">latest counterfactual</option>
              <option value="monte_carlo">latest monte carlo</option>
              <option value="sensitivity">latest sensitivity</option>
            </select>
          </label>
          <p className="scenarioCopy">{props.selectedScenario?.description}</p>
          <button className="primary" onClick={props.handleAudit} disabled={props.busy}>
            <Microscope size={16} />
            Run credibility audit
          </button>
        </section>

        <section className="panel conclusionPanel counterSummary">
          <div className="panelHeader">
            <span>credibility audit</span>
            <strong>{props.audit?.evidence_level ?? "idle"}</strong>
          </div>
          {props.audit ? (
            <>
              <strong>{props.audit.citation_summary}</strong>
              <dl className="readoutGrid">
                <Readout label="evidence level" value={props.audit.evidence_level} />
                <Readout label="robustness" value={`${Math.round(props.audit.robustness_score * 100)}%`} />
                <Readout label="assumptions" value={props.audit.assumption_coverage.length} />
                <Readout label="limitations" value={props.audit.primary_limitations.length} />
              </dl>
            </>
          ) : (
            <p className="empty">Generate an audit to separate exploratory narrative from model-internal evidence.</p>
          )}
        </section>
      </div>

      <section className="panel resultsPanel">
        <div className="panelHeader">
          <span>assumption coverage</span>
          <strong>{props.assumptions.length || "--"} assumptions</strong>
        </div>
        {props.audit ? (
          <div className="resultsTable">
            <div className="tableHeader credibilityHeader">
              <span>assumption</span>
              <span>status</span>
              <span>rationale</span>
            </div>
            {props.audit.assumption_coverage.map((item) => (
              <div className="tableRow credibilityRow" key={item.assumption_id}>
                <strong>{item.title}</strong>
                <span>{item.status}</span>
                <span>{item.rationale}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="resultsTable">
            {props.assumptions.map((item) => (
              <div className="tableRow credibilityRow" key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.applies_to.join(", ")}</span>
                <span>{item.limitations[0]}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {props.audit && (
        <section className="panel conclusionPanel">
          <div className="panelHeader">
            <span>limitations and followups</span>
            <FileText size={16} />
          </div>
          <div className="credibilityLists">
            <div>
              <strong>Primary limitations</strong>
              {props.audit.primary_limitations.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div>
              <strong>Recommended followups</strong>
              {props.audit.recommended_followups.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export function SweepWorkspace(props: {
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

export function CounterfactualWorkspace(props: {
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
