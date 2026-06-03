import type { CounterfactualResult, MonteCarloResult, ScenarioCompareResult, SensitivityResult, SweepParameter, SweepResult } from "../../types/sim";
import { formatDelta, percent } from "./utils";

export function SweepTables({ ranked, comparison, parameter }: { ranked: SweepResult["runs"]; comparison: ScenarioCompareResult[]; parameter: SweepParameter }) {
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

export function BranchComparison({ result }: { result?: CounterfactualResult }) {
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

export function MonteCarloTable({ result }: { result?: MonteCarloResult }) {
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

export function SensitivityTable({ result }: { result?: SensitivityResult }) {
  if (!result) return <div className="chartEmpty">Run sensitivity analysis to rank parameter effects.</div>;
  return (
    <div className="resultsTable">
      <div className="tableHeader sensitivityHeader">
        <span>parameter</span>
        <span>range</span>
        <span>split delta</span>
        <span>escalation delta</span>
        <span>confidence</span>
        <span>interpretation</span>
      </div>
      {result.results.map((item) => (
        <div className="tableRow sensitivityRow" key={item.parameter}>
          <strong>{item.parameter}</strong>
          <span>{item.low_value.toFixed(2)} to {item.high_value.toFixed(2)}</span>
          <span>{formatDelta(item.split_risk_delta)}</span>
          <span>{formatDelta(item.escalation_risk_delta)}</span>
          <span>{item.confidence}</span>
          <span>{item.interpretation}</span>
        </div>
      ))}
    </div>
  );
}
