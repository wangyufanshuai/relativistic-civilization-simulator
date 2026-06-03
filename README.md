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
- `GET /api/experiments/compare`
- `POST /api/experiments/sweep`
- `POST /api/experiments/counterfactual`
- `POST /api/experiments/report`
- `POST /api/ai/chronicle`
- `GET /api/report/{run_id}.md`
- `GET /api/exports/{run_id}.csv`

## Test

```powershell
cd E:\xuexi\relativistic-civilization-simulator\backend
pytest
```
