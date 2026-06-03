# Relativistic Civilization Simulator

An executable MVP for studying why interstellar empires struggle to stay centralized under relativistic constraints.

The simulator models star systems as a graph in light-year space. Communication is limited by light speed, colony ships take external years to arrive, near-light travel produces ship proper-time gaps, and distant colonies develop autonomy when delayed central governance cannot keep up.

## v0.2 Experiment Bench

The frontend now has two workspaces:

- `Simulation`: the live 3D star-map simulator.
- `Experiments`: deterministic scenario comparison and parameter sweeps.

The experiment bench supports scanning:

- `centralization`
- `ship_velocity_c`
- `expansion_pressure`
- `federation_bias`

It reports peak split risk, first split year, maximum polity count, average trade throughput, final control, and a rule-based summary.

## v0.3 Timeline Replay

The simulation workspace now includes a timeline replay layer:

- Lightweight snapshots are stored every 5 years, at the final year, and on major events.
- Drag the replay slider to inspect previous star-map states without changing the active run.
- The risk panel decomposes split risk into command pressure, delay pressure, unresolved autonomy, and loyalty loss.
- Experiment sweeps expose the peak risk breakdown for the highest-risk point.

## v0.4 Counterfactual Governance Lab

The experiment workspace now supports counterfactual governance runs:

- Fork a saved snapshot from an existing run and continue it as a new deterministic branch.
- Change only allowed governance and flight parameters: `centralization`, `ship_velocity_c`, `expansion_pressure`, and `federation_bias`.
- Compare original and counterfactual branches by split risk, central control, first split year, peak risk, and dominant risk factor.
- Generate rule-based Markdown experiment reports without requiring an AI key.

## v0.5 Faction Dynamics & Cold War Model

Political bodies now carry deterministic faction traits:

- `centralist`
- `federalist`
- `trade_league`
- `militarist`
- `frontier_science`
- `isolationist`

Traits alter trade, command pressure, frontier science, militarization, and cold-war escalation. Metrics now include `cold_war.deterrence_stability`, `cold_war.first_strike_pressure`, `cold_war.recall_delay`, `cold_war.escalation_risk`, and `cold_war.frontier_militarization`.

The frontend exposes these through the polity list, a Cold War Stability panel, and experiment metrics for escalation risk and deterrence stability.

## v0.6 Reproducible Experiment Polish

The project now includes the first productization layer:

- GitHub Actions CI for backend tests and frontend builds.
- Preset experiment buttons for central command stress, fleet-speed cold-war pressure, federal deterrence, and black-hole frontier trade.
- Markdown report generation is available for both parameter sweeps and counterfactual experiments.
- Frontend reports can be copied or downloaded directly from the experiment workspace.

## v0.7 Persistent Research Archive

Simulation runs are archived locally in `data/archive.sqlite`:

- Runs, metrics, events, snapshots, and generated reports survive backend restarts.
- The `Archive` workspace lists saved runs with split risk, cold-war risk, polity count, and snapshot count.
- Archived runs can be pinned, deleted, previewed as Markdown reports, exported as CSV, and loaded back into Simulation replay.

## v0.8 Monte Carlo Research Mode

The experiment workspace now includes multi-seed research mode:

- Run 3-100 deterministic seeds for the same scenario.
- Estimate split probability, mean split risk, escalation risk, central control, trade throughput, standard deviation, and 95% confidence intervals.
- Review seed-level outcomes in a table and compare uncertainty bands in a lightweight SVG chart.

## v0.9 Model Credibility Lab

The experiment workspace now includes local sensitivity analysis:

- Scan `centralization`, `ship_velocity_c`, `expansion_pressure`, and `federation_bias` around each scenario baseline.
- Compare low/base/high perturbations across multiple deterministic seeds.
- Rank parameters by combined impact on split risk, central control, cold-war escalation, and trade throughput.
- Generate a rule-based Markdown sensitivity report that states confidence as model-internal robustness, not external validation.

## v1.0 Engineering Hardening

The repository now includes browser-level release checks:

- Vite preview proxies `/api` to the FastAPI backend, matching the production preview path used by CI.
- `npm run smoke` launches a Playwright Chromium smoke test against the built app.
- GitHub Actions runs backend tests, frontend build, and an end-to-end browser smoke job that covers Simulation, Experiments, Archive, and `/api/health`.

## Run Backend

```powershell
cd E:\xuexi\relativistic-civilization-simulator\backend
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8030
```

## Run Frontend

```powershell
cd E:\xuexi\relativistic-civilization-simulator\frontend
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## API

- `GET /api/health`
- `GET /api/scenarios`
- `POST /api/simulations/start`
- `POST /api/simulations/step`
- `POST /api/simulations/run`
- `GET /api/simulations/{run_id}/state`
- `GET /api/simulations/{run_id}/metrics`
- `GET /api/simulations/{run_id}/events`
- `GET /api/simulations/{run_id}/snapshots`
- `POST /api/simulations/fork`
- `GET /api/archive/runs`
- `GET /api/archive/runs/{run_id}`
- `GET /api/archive/runs/{run_id}/snapshots`
- `GET /api/archive/runs/{run_id}/report.md`
- `DELETE /api/archive/runs/{run_id}`
- `POST /api/archive/runs/{run_id}/pin`
- `POST /api/archive/runs/{run_id}/unpin`
- `GET /api/experiments/compare`
- `POST /api/experiments/sweep`
- `POST /api/experiments/counterfactual`
- `POST /api/experiments/monte-carlo`
- `POST /api/experiments/sensitivity`
- `POST /api/experiments/report`
- `POST /api/ai/chronicle`
- `GET /api/report/{run_id}.md`
- `GET /api/exports/{run_id}.csv`

## Test

```powershell
cd E:\xuexi\relativistic-civilization-simulator\backend
pytest
```

```powershell
cd E:\xuexi\relativistic-civilization-simulator\frontend
npm run build
npm run smoke
```
