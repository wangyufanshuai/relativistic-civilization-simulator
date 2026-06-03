import type {
  ArchivedRun,
  ArchiveRunDetail,
  CounterfactualOverrides,
  CounterfactualResult,
  MonteCarloResult,
  Scenario,
  ScenarioCompareResult,
  SensitivityResult,
  SweepParameter,
  SweepResult,
  WorldSnapshot,
  WorldState
} from "../types/sim";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

export function listScenarios(): Promise<Scenario[]> {
  return request<Scenario[]>("/api/scenarios");
}

export function startSimulation(scenario: string, seed = 42): Promise<WorldState> {
  return request<WorldState>("/api/simulations/start", {
    method: "POST",
    body: JSON.stringify({ scenario, seed })
  });
}

export function stepSimulation(runId: string, steps: number): Promise<WorldState> {
  return request<WorldState>("/api/simulations/step", {
    method: "POST",
    body: JSON.stringify({ run_id: runId, steps })
  });
}

export function listSnapshots(runId: string): Promise<WorldSnapshot[]> {
  return request<WorldSnapshot[]>(`/api/simulations/${runId}/snapshots`);
}

export function runSimulation(scenario: string, steps: number, seed = 42): Promise<WorldState> {
  return request<WorldState>("/api/simulations/run", {
    method: "POST",
    body: JSON.stringify({ scenario, seed, steps })
  });
}

export function chronicle(runId: string): Promise<{ provider: string; chronicle: string }> {
  return request<{ provider: string; chronicle: string }>("/api/ai/chronicle", {
    method: "POST",
    body: JSON.stringify({ run_id: runId })
  });
}

export function compareScenarios(steps = 80, seed = 42): Promise<ScenarioCompareResult[]> {
  return request<ScenarioCompareResult[]>(`/api/experiments/compare?steps=${steps}&seed=${seed}`);
}

export function runSweep(
  scenario: string,
  parameter: SweepParameter,
  values: number[],
  steps = 120,
  seed = 42
): Promise<SweepResult> {
  return request<SweepResult>("/api/experiments/sweep", {
    method: "POST",
    body: JSON.stringify({ scenario, parameter, values, steps, seed })
  });
}

export function forkSimulation(
  runId: string,
  snapshotYear: number,
  steps: number,
  overrides: CounterfactualOverrides
): Promise<WorldState> {
  return request<WorldState>("/api/simulations/fork", {
    method: "POST",
    body: JSON.stringify({ run_id: runId, snapshot_year: snapshotYear, steps, overrides })
  });
}

export function runCounterfactual(
  runId: string,
  snapshotYear: number,
  steps: number,
  overrides: CounterfactualOverrides
): Promise<CounterfactualResult> {
  return request<CounterfactualResult>("/api/experiments/counterfactual", {
    method: "POST",
    body: JSON.stringify({ run_id: runId, snapshot_year: snapshotYear, steps, overrides })
  });
}

export function experimentReport(kind: "counterfactual" | "sweep", payload: object): Promise<{ markdown: string }> {
  return request<{ markdown: string }>("/api/experiments/report", {
    method: "POST",
    body: JSON.stringify({ kind, payload })
  });
}

export function sensitivityReport(payload: object): Promise<{ markdown: string }> {
  return request<{ markdown: string }>("/api/experiments/report", {
    method: "POST",
    body: JSON.stringify({ kind: "sensitivity", payload })
  });
}

export function listArchivedRuns(): Promise<ArchivedRun[]> {
  return request<ArchivedRun[]>("/api/archive/runs");
}

export function getArchivedRun(runId: string): Promise<ArchiveRunDetail> {
  return request<ArchiveRunDetail>(`/api/archive/runs/${runId}`);
}

export function getArchivedReport(runId: string): Promise<string> {
  return requestText(`/api/archive/runs/${runId}/report.md`);
}

export function deleteArchivedRun(runId: string): Promise<{ status: string; run_id: string }> {
  return request<{ status: string; run_id: string }>(`/api/archive/runs/${runId}`, { method: "DELETE" });
}

export function pinArchivedRun(runId: string): Promise<ArchivedRun> {
  return request<ArchivedRun>(`/api/archive/runs/${runId}/pin`, { method: "POST" });
}

export function unpinArchivedRun(runId: string): Promise<ArchivedRun> {
  return request<ArchivedRun>(`/api/archive/runs/${runId}/unpin`, { method: "POST" });
}

export function runMonteCarlo(scenario: string, seeds: number[], steps: number): Promise<MonteCarloResult> {
  return request<MonteCarloResult>("/api/experiments/monte-carlo", {
    method: "POST",
    body: JSON.stringify({ scenario, seeds, steps })
  });
}

export function runSensitivity(
  scenario: string,
  parameters: SweepParameter[],
  steps: number,
  seedStart: number,
  seedCount: number,
  perturbation: number
): Promise<SensitivityResult> {
  return request<SensitivityResult>("/api/experiments/sensitivity", {
    method: "POST",
    body: JSON.stringify({ scenario, parameters, steps, seed_start: seedStart, seed_count: seedCount, perturbation })
  });
}
