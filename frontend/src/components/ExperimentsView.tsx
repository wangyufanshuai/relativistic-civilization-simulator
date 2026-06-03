import React from "react";
import { compareScenarios, experimentReport, runCounterfactual, runMonteCarlo, runSensitivity, runSimulation, runSweep, sensitivityReport } from "../lib/api";
import { experimentPresets, parameterDefaults } from "./experiments/constants";
import { CounterfactualWorkspace, MonteCarloWorkspace, SensitivityWorkspace, SweepWorkspace } from "./experiments/workspaces";
import type {
  CounterfactualResult,
  ExperimentMetricKey,
  MonteCarloResult,
  Scenario,
  ScenarioCompareResult,
  SensitivityResult,
  SweepParameter,
  SweepResult
} from "../types/sim";

interface ExperimentsViewProps {
  scenarios: Scenario[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
}

export function ExperimentsView({ scenarios, busy, setBusy, setStatus }: ExperimentsViewProps) {
  const [mode, setMode] = React.useState<"sweep" | "counterfactual" | "monteCarlo" | "sensitivity">("sweep");
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
  const [sensitivity, setSensitivity] = React.useState<SensitivityResult>();
  const [sensitivitySteps, setSensitivitySteps] = React.useState(120);
  const [sensitivitySeedStart, setSensitivitySeedStart] = React.useState(200);
  const [sensitivitySeedCount, setSensitivitySeedCount] = React.useState(8);
  const [perturbation, setPerturbation] = React.useState(0.22);
  const [sensitivityReportText, setSensitivityReportText] = React.useState("");

  React.useEffect(() => {
    void handleInitialLoad();
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

  async function handleInitialLoad() {
    setBusy(true);
    try {
      setStatus("preparing experiment bench");
      const initialSweep = await runSweep("baseline_empire", "centralization", parameterDefaults.centralization, 140, 42);
      setSweep(initialSweep);
      setStatus("comparing scenarios");
      const initialComparison = await compareScenarios(100, 42);
      setComparison(initialComparison);
      setStatus("experiment bench ready");
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

  async function handleSensitivity() {
    const parameters = Object.keys(parameterDefaults) as SweepParameter[];
    const result = await runExperimentTask("running sensitivity analysis", () =>
      runSensitivity(scenario, parameters, sensitivitySteps, sensitivitySeedStart, sensitivitySeedCount, perturbation)
    );
    setSensitivity(result);
    setSensitivityReportText("");
  }

  async function handleSensitivityReport() {
    if (!sensitivity) return;
    const result = await runExperimentTask("generating sensitivity report", () => sensitivityReport(sensitivity));
    setSensitivityReportText(result.markdown);
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
          <span>v0.9 model credibility lab</span>
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
          <button className={mode === "sensitivity" ? "active" : ""} onClick={() => setMode("sensitivity")}>
            Sensitivity
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
      ) : mode === "monteCarlo" ? (
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
      ) : (
        <SensitivityWorkspace
          busy={busy}
          scenario={scenario}
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          steps={sensitivitySteps}
          seedStart={sensitivitySeedStart}
          seedCount={sensitivitySeedCount}
          perturbation={perturbation}
          result={sensitivity}
          reportText={sensitivityReportText}
          setScenario={setScenario}
          setSteps={setSensitivitySteps}
          setSeedStart={setSensitivitySeedStart}
          setSeedCount={setSensitivitySeedCount}
          setPerturbation={setPerturbation}
          handleRun={handleSensitivity}
          handleReport={handleSensitivityReport}
        />
      )}
    </section>
  );
}
