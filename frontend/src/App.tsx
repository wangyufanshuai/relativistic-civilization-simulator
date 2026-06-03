import React from "react";
import { Activity, CircleDot, FlaskConical, Network, Orbit, RadioTower, ShieldAlert } from "lucide-react";
import { chronicle, listScenarios, listSnapshots, runSimulation, startSimulation, stepSimulation } from "./lib/api";
import { EventLog } from "./components/EventLog";
import { ExperimentsView } from "./components/ExperimentsView";
import { Inspector } from "./components/Inspector";
import { MetricStrip } from "./components/MetricStrip";
import { SceneViewport } from "./components/SceneViewport";
import { TimelineReplay } from "./components/TimelineReplay";
import type { Scenario, WorldSnapshot, WorldState } from "./types/sim";

export default function App() {
  const [scenarios, setScenarios] = React.useState<Scenario[]>([]);
  const [scenario, setScenario] = React.useState("baseline_empire");
  const [world, setWorld] = React.useState<WorldState>();
  const [snapshots, setSnapshots] = React.useState<WorldSnapshot[]>([]);
  const [snapshotIndex, setSnapshotIndex] = React.useState(0);
  const [replayPlaying, setReplayPlaying] = React.useState(false);
  const [selectedSystemId, setSelectedSystemId] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("initializing relativistic model");
  const [chronicleText, setChronicleText] = React.useState("");
  const [view, setView] = React.useState<"simulation" | "experiments">("simulation");

  React.useEffect(() => {
    void bootstrap();
  }, []);

  React.useEffect(() => {
    if (!replayPlaying || snapshots.length < 2) return;
    const timer = window.setInterval(() => {
      setSnapshotIndex((current) => {
        if (current >= snapshots.length - 1) {
          setReplayPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [replayPlaying, snapshots.length]);

  async function runTask<T>(message: string, task: () => Promise<T>): Promise<T> {
    setBusy(true);
    setStatus(message);
    try {
      const result = await task();
      setStatus("simulation online");
      return result;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "unexpected simulator error");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function bootstrap() {
    const loadedScenarios = await runTask("loading scenarios", listScenarios);
    setScenarios(loadedScenarios);
    const initial = await runTask("starting baseline_empire", () => startSimulation("baseline_empire", 42));
    await applyWorld(initial);
  }

  async function applyWorld(next: WorldState) {
    setWorld(next);
    const nextSnapshots = await listSnapshots(next.run_id);
    setSnapshots(nextSnapshots);
    setSnapshotIndex(Math.max(0, nextSnapshots.length - 1));
    setSelectedSystemId((current) => current ?? "sol");
    setReplayPlaying(false);
  }

  async function handleStart() {
    const next = await runTask(`starting ${scenario}`, () => startSimulation(scenario, 42));
    await applyWorld(next);
    setSelectedSystemId("sol");
    setChronicleText("");
  }

  async function handleStep(steps: number) {
    if (!world) return;
    const next = await runTask(steps === 1 ? "advancing one light-year year" : `running ${steps} years`, () =>
      stepSimulation(world.run_id, steps)
    );
    await applyWorld(next);
    setSelectedSystemId((current) => current ?? "sol");
  }

  async function handleScenarioChange(nextScenario: string) {
    setScenario(nextScenario);
    const next = await runTask(`running ${nextScenario}`, () => runSimulation(nextScenario, 40, 42));
    await applyWorld(next);
    setSelectedSystemId("sol");
    setChronicleText("");
  }

  async function handleChronicle() {
    if (!world) return;
    const response = await runTask("generating chronicle", () => chronicle(world.run_id));
    setChronicleText(response.chronicle);
  }

  const activeSnapshot = snapshots[snapshotIndex];
  const displayMetric = activeSnapshot?.metrics ?? world?.latest;
  const displayWorld =
    activeSnapshot && world
      ? {
          year: activeSnapshot.year,
          systems: activeSnapshot.systems,
          polities: activeSnapshot.polities,
          fleets: activeSnapshot.fleets,
          trade_routes: activeSnapshot.trade_routes,
          black_hole: world.black_hole,
        }
      : world;

  return (
    <main className="appShell">
      <nav className="rail">
        <div className="brandMark"><Orbit size={22} /></div>
        <RailIcon icon={<CircleDot size={18} />} active={view === "simulation"} label="simulation" onClick={() => setView("simulation")} />
        <RailIcon icon={<FlaskConical size={18} />} active={view === "experiments"} label="experiments" onClick={() => setView("experiments")} />
        <RailIcon icon={<RadioTower size={18} />} label="messages" />
        <RailIcon icon={<Network size={18} />} label="polities" />
        <RailIcon icon={<ShieldAlert size={18} />} label="tension" />
      </nav>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Relativistic Civilization Simulator</h1>
            <p>{status}</p>
          </div>
          <div className="statusCluster">
            <span className={busy ? "dot active" : "dot"} />
            <strong>{busy ? "processing" : "online"}</strong>
          </div>
        </header>

        {view === "simulation" ? (
          <>
            <MetricStrip metric={displayMetric} />

            <section className="contentGrid">
              <div className="mainColumn">
                <div className="modeBar">
                  <div>
                    <Activity size={15} />
                    <span>c = 1 ly/year - delayed communication - relativistic fleets - approximate GR frontier</span>
                  </div>
                  <strong>{displayWorld ? `${displayWorld.systems.filter((system) => system.population > 0).length}/${displayWorld.systems.length} systems` : "--"}</strong>
                </div>
                <TimelineReplay
                  snapshots={snapshots}
                  index={snapshotIndex}
                  playing={replayPlaying}
                  onChange={(index) => {
                    setReplayPlaying(false);
                    setSnapshotIndex(index);
                  }}
                  onTogglePlay={() => setReplayPlaying((value) => !value)}
                  onLatest={() => {
                    setReplayPlaying(false);
                    setSnapshotIndex(Math.max(0, snapshots.length - 1));
                  }}
                />
                <SceneViewport world={displayWorld} metric={displayMetric} selectedSystemId={selectedSystemId} onSelectSystem={setSelectedSystemId} />
                <EventLog events={activeSnapshot?.events ?? world?.events ?? []} />
              </div>

              <Inspector
                world={world}
                scenarios={scenarios}
                scenario={scenario}
                busy={busy}
                displayMetric={displayMetric}
                displayYear={activeSnapshot?.year}
                chronicleText={chronicleText}
                onScenarioChange={handleScenarioChange}
                onStart={handleStart}
                onStep={handleStep}
                onChronicle={handleChronicle}
              />
            </section>
          </>
        ) : (
          <ExperimentsView scenarios={scenarios} busy={busy} setBusy={setBusy} setStatus={setStatus} />
        )}
      </section>
    </main>
  );
}

function RailIcon({ icon, active, label, onClick }: { icon: React.ReactNode; active?: boolean; label: string; onClick?: () => void }) {
  return (
    <button className={active ? "railButton active" : "railButton"} aria-label={label} title={label} onClick={onClick}>
      {icon}
    </button>
  );
}
