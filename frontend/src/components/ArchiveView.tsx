import React from "react";
import { Download, Eye, FolderArchive, Pin, PinOff, Play, RefreshCw, Trash2 } from "lucide-react";
import { deleteArchivedRun, getArchivedReport, getArchivedRun, listArchivedRuns, pinArchivedRun, runCredibilityAudit, unpinArchivedRun } from "../lib/api";
import type { ArchivedRun, CredibilityAudit, WorldState } from "../types/sim";

interface ArchiveViewProps {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
  onLoadRun: (world: WorldState) => Promise<void>;
}

export function ArchiveView({ busy, setBusy, setStatus, onLoadRun }: ArchiveViewProps) {
  const [runs, setRuns] = React.useState<ArchivedRun[]>([]);
  const [selected, setSelected] = React.useState<ArchivedRun>();
  const [report, setReport] = React.useState("");
  const [audit, setAudit] = React.useState<CredibilityAudit>();

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!selected) {
      setAudit(undefined);
      return;
    }
    let cancelled = false;
    runCredibilityAudit("run", undefined, selected.run_id)
      .then((result) => {
        if (!cancelled) setAudit(result);
      })
      .catch(() => {
        if (!cancelled) setAudit(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function task<T>(status: string, work: () => Promise<T>): Promise<T> {
    setBusy(true);
    setStatus(status);
    try {
      const result = await work();
      setStatus("archive ready");
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const next = await task("loading archive", listArchivedRuns);
    setRuns(next);
    setSelected((current) => next.find((run) => run.run_id === current?.run_id) ?? next[0]);
  }

  async function loadRun(runId: string) {
    const detail = await task("loading archived run", () => getArchivedRun(runId));
    await onLoadRun(detail.state);
  }

  async function togglePin(run: ArchivedRun) {
    await task(run.pinned ? "unpinning run" : "pinning run", () => (run.pinned ? unpinArchivedRun(run.run_id) : pinArchivedRun(run.run_id)));
    await refresh();
  }

  async function removeRun(runId: string) {
    await task("deleting archived run", () => deleteArchivedRun(runId));
    setReport("");
    await refresh();
  }

  async function previewReport(runId: string) {
    const markdown = await task("loading report", () => getArchivedReport(runId));
    setReport(markdown);
  }

  return (
    <section className="archiveShell">
      <div className="experimentHero">
        <div>
          <span>v0.7 persistent research archive</span>
          <h2>Saved runs, reports, and replayable histories</h2>
          <p>Reload deterministic runs from local SQLite, pin important histories, and bring archived timelines back into the simulator.</p>
        </div>
        <button className="primary" onClick={refresh} disabled={busy}>
          <RefreshCw size={16} />
          Refresh archive
        </button>
      </div>

      <div className="archiveGrid">
        <section className="panel archiveListPanel">
          <div className="panelHeader">
            <span>archived runs</span>
            <strong>{runs.length || "--"}</strong>
          </div>
          <div className="archiveList">
            {runs.map((run) => (
              <button
                key={run.run_id}
                className={selected?.run_id === run.run_id ? "archiveRun active" : "archiveRun"}
                onClick={() => setSelected(run)}
              >
                <span>{run.pinned ? "pinned" : run.scenario}</span>
                <strong>{run.run_id}</strong>
                <small>
                  y{run.year} - split {Math.round(run.final_metrics.split_risk * 100)}% - cold {Math.round(run.final_metrics.cold_war.escalation_risk * 100)}%
                </small>
              </button>
            ))}
            {runs.length === 0 && <div className="chartEmpty">Run a simulation to create the first archived history.</div>}
          </div>
        </section>

        <section className="panel archiveDetailPanel">
          <div className="panelHeader">
            <span>run detail</span>
            <FolderArchive size={16} />
          </div>
          {selected ? (
            <>
              <dl className="readoutGrid">
                <Readout label="scenario" value={selected.scenario} />
                <Readout label="year" value={selected.year} />
                <Readout label="polities" value={selected.final_metrics.polities} />
                <Readout label="snapshots" value={selected.snapshot_count} />
                <Readout label="split risk" value={`${Math.round(selected.final_metrics.split_risk * 100)}%`} />
                <Readout label="escalation" value={`${Math.round(selected.final_metrics.cold_war.escalation_risk * 100)}%`} />
                <Readout label="evidence" value={audit?.evidence_level ?? "--"} />
                <Readout label="robustness" value={audit ? `${Math.round(audit.robustness_score * 100)}%` : "--"} />
              </dl>
              <div className="archiveActions">
                <button className="primary" onClick={() => loadRun(selected.run_id)} disabled={busy}>
                  <Play size={15} />
                  Load into Simulation
                </button>
                <button onClick={() => togglePin(selected)} disabled={busy}>
                  {selected.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                  {selected.pinned ? "Unpin" : "Pin"}
                </button>
                <button onClick={() => previewReport(selected.run_id)} disabled={busy}>
                  <Eye size={15} />
                  Preview report
                </button>
                <a href={`/api/exports/${selected.run_id}.csv`}>
                  <Download size={15} />
                  Metrics CSV
                </a>
                <a href={`/api/archive/runs/${selected.run_id}/manifest.json`}>
                  <Download size={15} />
                  Manifest JSON
                </a>
                <button onClick={() => removeRun(selected.run_id)} disabled={busy}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </>
          ) : (
            <p className="empty">Select an archived run to inspect its summary.</p>
          )}
        </section>
      </div>

      {report && (
        <section className="panel reportPanel">
          <div className="panelHeader">
            <span>report preview</span>
            <FolderArchive size={16} />
          </div>
          <pre>{report}</pre>
        </section>
      )}
    </section>
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
