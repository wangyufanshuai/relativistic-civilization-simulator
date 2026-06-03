import { BrainCircuit, FileText, Gauge, Play, RadioTower, RotateCcw, SkipForward } from "lucide-react";
import { RiskBreakdownPanel } from "./RiskBreakdownPanel";
import type { Metric, Scenario, WorldState } from "../types/sim";

interface InspectorProps {
  world?: WorldState;
  scenarios: Scenario[];
  scenario: string;
  busy: boolean;
  displayMetric?: Metric;
  displayYear?: number;
  chronicleText: string;
  onScenarioChange: (scenario: string) => void;
  onStart: () => void;
  onStep: (steps: number) => void;
  onChronicle: () => void;
}

export function Inspector({
  world,
  scenarios,
  scenario,
  busy,
  displayMetric,
  displayYear,
  chronicleText,
  onScenarioChange,
  onStart,
  onStep,
  onChronicle
}: InspectorProps) {
  const activeScenario = scenarios.find((item) => item.id === scenario);
  return (
    <aside className="inspector">
      <section className="panel">
        <div className="panelHeader">
          <span>scenario</span>
          <strong>{world ? `year ${displayYear ?? world.year}` : "idle"}</strong>
        </div>
        <select value={scenario} onChange={(event) => onScenarioChange(event.target.value)} disabled={busy}>
          {scenarios.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
        <p className="scenarioCopy">{activeScenario?.description}</p>
        <div className="buttonRow">
          <button onClick={onStart} disabled={busy}>
            <RotateCcw size={15} />
            Restart
          </button>
          <button onClick={() => onStep(1)} disabled={busy || !world}>
            <SkipForward size={15} />
            Step +1y
          </button>
          <button className="primary" onClick={() => onStep(50)} disabled={busy || !world}>
            <Play size={15} />
            Run 50y
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <span>relativistic constraints</span>
          <Gauge size={16} />
        </div>
        <dl className="readoutGrid">
          <div>
            <dt>ship velocity</dt>
            <dd>{world ? `${world.config.ship_velocity_c.toFixed(2)}c` : "--"}</dd>
          </div>
          <div>
            <dt>colonized</dt>
            <dd>{displayMetric?.colonized_systems ?? world?.latest.colonized_systems ?? "--"}</dd>
          </div>
          <div>
            <dt>polities</dt>
            <dd>{displayMetric?.polities ?? world?.latest.polities ?? "--"}</dd>
          </div>
          <div>
            <dt>fleets</dt>
            <dd>{displayMetric?.fleet_count ?? world?.latest.fleet_count ?? "--"}</dd>
          </div>
        </dl>
      </section>

      <RiskBreakdownPanel metric={displayMetric ?? world?.latest} />

      <ColdWarPanel metric={displayMetric ?? world?.latest} />

      <section className="panel">
        <div className="panelHeader">
          <span>frontier politics</span>
          <BrainCircuit size={16} />
        </div>
        <div className="polityList">
          {(world?.polities ?? []).slice(0, 8).map((polity) => (
            <div className="polityRow" key={polity.id}>
              <i style={{ background: polity.color }} />
              <div>
                <strong>{polity.name}</strong>
                <span>{polity.trait} - centralization {Math.round(polity.centralization * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel chroniclePanel">
        <div className="panelHeader">
          <span>AI chronicle</span>
          <FileText size={16} />
        </div>
        <button onClick={onChronicle} disabled={busy || !world}>
          Generate summary
        </button>
        <p>{chronicleText || "Optional narrative layer. The rules engine owns all state transitions."}</p>
      </section>
    </aside>
  );
}

function ColdWarPanel({ metric }: { metric?: Metric }) {
  const coldWar = metric?.cold_war;
  return (
    <section className="panel coldWarPanel">
      <div className="panelHeader">
        <span>cold war stability</span>
        <RadioTower size={16} />
      </div>
      <dl className="readoutGrid">
        <div>
          <dt>deterrence</dt>
          <dd>{coldWar ? `${Math.round(coldWar.deterrence_stability * 100)}%` : "--"}</dd>
        </div>
        <div>
          <dt>escalation</dt>
          <dd>{coldWar ? `${Math.round(coldWar.escalation_risk * 100)}%` : "--"}</dd>
        </div>
        <div>
          <dt>recall delay</dt>
          <dd>{coldWar ? `${Math.round(coldWar.recall_delay * 100)}%` : "--"}</dd>
        </div>
        <div>
          <dt>militarized</dt>
          <dd>{coldWar ? `${Math.round(coldWar.frontier_militarization * 100)}%` : "--"}</dd>
        </div>
      </dl>
    </section>
  );
}
