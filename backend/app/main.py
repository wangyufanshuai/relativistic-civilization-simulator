from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from app.engine import RelativisticCivilizationEngine
from app.llm_client import generate_chronicle
from app.models import (
    CausalDelta,
    CounterfactualBranch,
    CounterfactualRequest,
    CounterfactualResult,
    Event,
    EventType,
    ExperimentRun,
    ExperimentReportRequest,
    ExperimentSummary,
    ForkSimulationRequest,
    RunSimulationRequest,
    SimulationConfig,
    StartSimulationRequest,
    StepSimulationRequest,
    SweepRequest,
    SweepResult,
    WorldSnapshot,
    WorldState,
)
from app.report import experiment_report, markdown_report, world_for_ai
from app.scenarios import SCENARIOS, scenario_config
from app.store import store


app = FastAPI(title="Relativistic Civilization Simulator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Relativistic Civilization Simulator"}


@app.get("/api/scenarios")
def scenarios() -> list[dict[str, object]]:
    return [scenario.model_dump() for scenario in SCENARIOS]


@app.post("/api/simulations/start")
def start(request: StartSimulationRequest) -> dict[str, object]:
    config = scenario_config(request.scenario, request.seed)
    world = RelativisticCivilizationEngine(config).create_world()
    store.put(world)
    store.reset_snapshots(world)
    store.add_snapshot(world)
    return summarize_world(world)


@app.post("/api/simulations/step")
def step(request: StepSimulationRequest) -> dict[str, object]:
    try:
        world = store.get(request.run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc
    _advance_with_snapshots(world, request.steps, include_snapshots=True)
    store.put(world)
    return summarize_world(world)


@app.post("/api/simulations/run")
def run(request: RunSimulationRequest) -> dict[str, object]:
    config = scenario_config(request.scenario, request.seed)
    world = RelativisticCivilizationEngine(config).create_world()
    store.put(world)
    store.reset_snapshots(world)
    if request.include_snapshots:
        store.add_snapshot(world)
    _advance_with_snapshots(world, request.steps, include_snapshots=request.include_snapshots)
    store.put(world)
    return summarize_world(world)


@app.get("/api/simulations/{run_id}/state")
def state(run_id: str) -> dict[str, object]:
    try:
        return summarize_world(store.get(run_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc


@app.get("/api/simulations/{run_id}/metrics")
def metrics(run_id: str) -> list[dict[str, object]]:
    try:
        return [metric.model_dump() for metric in store.get(run_id).metrics]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc


@app.get("/api/simulations/{run_id}/events")
def events(run_id: str) -> list[dict[str, object]]:
    try:
        return [event.model_dump(mode="json") for event in store.get(run_id).events]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc


@app.get("/api/simulations/{run_id}/snapshots")
def snapshots(run_id: str) -> list[dict[str, object]]:
    try:
        return [snapshot.model_dump(mode="json") for snapshot in store.snapshots(run_id)]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc


@app.get("/api/archive/runs")
def archive_runs() -> list[dict[str, object]]:
    return [run.model_dump(mode="json") for run in store.list_archive()]


@app.get("/api/archive/runs/{run_id}")
def archive_run(run_id: str) -> dict[str, object]:
    try:
        return store.archive_detail(run_id).model_dump(mode="json")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="archived run not found") from exc


@app.get("/api/archive/runs/{run_id}/snapshots")
def archive_snapshots(run_id: str) -> list[dict[str, object]]:
    try:
        return [snapshot.model_dump(mode="json") for snapshot in store.snapshots(run_id)]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="archived run not found") from exc


@app.get("/api/archive/runs/{run_id}/report.md", response_class=PlainTextResponse)
def archive_report(run_id: str) -> str:
    try:
        report_text = store.report(run_id)
        if not report_text:
            report_text = markdown_report(store.get(run_id))
            store.save_report(run_id, report_text)
        return report_text
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="archived run not found") from exc


@app.delete("/api/archive/runs/{run_id}")
def delete_archive_run(run_id: str) -> dict[str, str]:
    try:
        store.delete_archive(run_id)
        return {"status": "deleted", "run_id": run_id}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="archived run not found") from exc


@app.post("/api/archive/runs/{run_id}/pin")
def pin_archive_run(run_id: str) -> dict[str, object]:
    try:
        return store.set_pinned(run_id, True).model_dump(mode="json")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="archived run not found") from exc


@app.post("/api/archive/runs/{run_id}/unpin")
def unpin_archive_run(run_id: str) -> dict[str, object]:
    try:
        return store.set_pinned(run_id, False).model_dump(mode="json")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="archived run not found") from exc


@app.post("/api/simulations/fork")
def fork_simulation(request: ForkSimulationRequest) -> dict[str, object]:
    try:
        base = store.get(request.run_id)
        base_snapshots = store.snapshots(request.run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc
    snapshot = _nearest_snapshot(base_snapshots, request.snapshot_year)
    world = _world_from_snapshot(base, snapshot, _override_config(base.config, request.overrides.model_dump(exclude_none=True)))
    _add_fork_event(world, base.run_id, snapshot.year)
    store.put(world)
    store.reset_snapshots(world)
    if request.include_snapshots:
        store.add_snapshot(world)
    _advance_with_snapshots(world, request.steps, include_snapshots=request.include_snapshots)
    if not any(event.title == "Counterfactual branch forked" for event in world.events):
        _add_fork_event(world, base.run_id, snapshot.year)
    store.put(world)
    return summarize_world(world)


@app.get("/api/experiments/compare")
def compare(steps: int = 80, seed: int = 42) -> list[dict[str, object]]:
    results = []
    for scenario in SCENARIOS:
        config = scenario_config(scenario.id, seed)
        world = RelativisticCivilizationEngine(config).create_world()
        RelativisticCivilizationEngine(config).run(world, steps)
        latest = world.metrics[-1].model_dump()
        results.append({"scenario": scenario.id, **latest})
    return results


@app.post("/api/experiments/sweep")
def sweep(request: SweepRequest) -> dict[str, object]:
    runs = []
    for raw_value in request.values:
        value = _validated_sweep_value(request.parameter, raw_value)
        config = scenario_config(request.scenario, request.seed)
        setattr(config, request.parameter, value)
        world = RelativisticCivilizationEngine(config).create_world()
        local_snapshots: list[WorldSnapshot] = []
        if request.include_snapshots:
            local_snapshots.append(_snapshot_for_experiment(world))
        engine = RelativisticCivilizationEngine(config)
        for index in range(request.steps):
            engine.step(world)
            if request.include_snapshots and _should_capture_snapshot(world, index + 1, request.steps):
                local_snapshots.append(_snapshot_for_experiment(world))
        timeline = world.metrics
        peak_metric = max(timeline, key=lambda metric: metric.split_risk)
        first_split = next((metric.year for metric in timeline if metric.polities > 1), None)
        runs.append(
            ExperimentRun(
                parameter_value=round(value, 4),
                final_metrics=timeline[-1],
                timeline=timeline,
                peak_split_risk=round(max(metric.split_risk for metric in timeline), 4),
                year_of_first_split=first_split,
                max_polities=max(metric.polities for metric in timeline),
                average_trade_throughput=round(
                    sum(metric.trade_throughput for metric in timeline) / max(1, len(timeline)),
                    4,
                ),
                peak_risk_breakdown=peak_metric.risk_breakdown,
                snapshots=local_snapshots,
            )
        )
    result = SweepResult(
        scenario=request.scenario,
        parameter=request.parameter,
        runs=runs,
        summary=_summarize_sweep(request.parameter, runs),
    )
    return result.model_dump(mode="json")


@app.post("/api/experiments/counterfactual")
def counterfactual(request: CounterfactualRequest) -> dict[str, object]:
    try:
        base = store.get(request.run_id)
        base_snapshots = store.snapshots(request.run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc
    snapshot = _nearest_snapshot(base_snapshots, request.snapshot_year)
    overrides = request.overrides.model_dump(exclude_none=True)

    original = _world_from_snapshot(base, snapshot, base.config.model_copy(deep=True))
    counter = _world_from_snapshot(base, snapshot, _override_config(base.config, overrides))
    _add_fork_event(counter, base.run_id, snapshot.year)

    original_snaps = [_snapshot_for_experiment(original)]
    counter_snaps = [_snapshot_for_experiment(counter)]
    _advance_local_with_snapshots(original, request.steps, original_snaps)
    _advance_local_with_snapshots(counter, request.steps, counter_snaps)
    if not any(event.title == "Counterfactual branch forked" for event in counter.events):
        _add_fork_event(counter, base.run_id, snapshot.year)

    store.put(counter)
    store.replace_snapshots(counter.run_id, counter_snaps)

    original_branch = _counterfactual_branch(original, original_snaps)
    counter_branch = _counterfactual_branch(counter, counter_snaps)
    delta = _causal_delta(original_branch, counter_branch)
    result = CounterfactualResult(
        base_run_id=base.run_id,
        fork_run_id=counter.run_id,
        snapshot_year=snapshot.year,
        overrides={key: round(float(value), 4) for key, value in overrides.items()},
        original=original_branch,
        counterfactual=counter_branch,
        delta=delta,
        summary=delta.interpretation,
    )
    return result.model_dump(mode="json")


@app.post("/api/experiments/report")
def report_experiment(request: ExperimentReportRequest) -> dict[str, str]:
    markdown = experiment_report(request.kind, request.payload)
    run_id = request.payload.get("fork_run_id") or request.payload.get("run_id")
    if isinstance(run_id, str):
        try:
            store.save_report(run_id, markdown)
        except KeyError:
            pass
    return {"markdown": markdown}


@app.post("/api/ai/chronicle")
def ai_chronicle(payload: dict[str, str]) -> dict[str, object]:
    run_id = payload.get("run_id")
    if not run_id:
        raise HTTPException(status_code=422, detail="run_id is required")
    try:
        world = store.get(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc
    return generate_chronicle(world_for_ai(world))


def _validated_sweep_value(parameter: str, value: float) -> float:
    ranges = {
        "centralization": (0.0, 1.0),
        "ship_velocity_c": (0.05, 0.98),
        "expansion_pressure": (0.0, 1.0),
        "federation_bias": (0.0, 1.0),
    }
    lower, upper = ranges[parameter]
    if value < lower or value > upper:
        raise HTTPException(status_code=422, detail=f"{parameter} must be between {lower} and {upper}")
    return float(value)


def _override_config(config: SimulationConfig, overrides: dict[str, float]) -> SimulationConfig:
    next_config = config.model_copy(deep=True)
    for key, value in overrides.items():
        if key not in {"centralization", "ship_velocity_c", "expansion_pressure", "federation_bias"}:
            raise HTTPException(status_code=422, detail=f"unsupported override: {key}")
        setattr(next_config, key, float(value))
    return next_config


def _nearest_snapshot(snapshots: list[WorldSnapshot], year: int) -> WorldSnapshot:
    if not snapshots:
        raise HTTPException(status_code=404, detail="simulation snapshots not found")
    return min(snapshots, key=lambda snapshot: (abs(snapshot.year - year), snapshot.year))


def _world_from_snapshot(base: WorldState, snapshot: WorldSnapshot, config: SimulationConfig) -> WorldState:
    polities = [polity.model_copy(deep=True) for polity in snapshot.polities]
    _apply_config_to_empire(polities, config)
    return WorldState(
        year=snapshot.year,
        config=config,
        civilization=base.civilization.model_copy(deep=True),
        systems=[system.model_copy(deep=True) for system in snapshot.systems],
        polities=polities,
        fleets=[fleet.model_copy(deep=True) for fleet in snapshot.fleets],
        messages=[message.model_copy(deep=True) for message in snapshot.messages],
        trade_routes=[route.model_copy(deep=True) for route in snapshot.trade_routes],
        war=base.war.model_copy(deep=True),
        black_hole=base.black_hole.model_copy(deep=True) if base.black_hole else None,
        events=[event.model_copy(deep=True) for event in snapshot.events],
        metrics=[snapshot.metrics.model_copy(deep=True)],
    )


def _apply_config_to_empire(polities: list, config: SimulationConfig) -> None:
    empire = next((polity for polity in polities if polity.id == "empire"), None)
    if not empire:
        return
    empire.centralization = config.centralization
    empire.autonomy_tolerance = min(0.85, 0.30 + (1.0 - config.centralization) * 0.28 + config.federation_bias * 0.42)
    empire.trade_openness = 0.52 + config.federation_bias * 0.22
    empire.militarization = 0.25 + config.centralization * 0.22


def _add_fork_event(world: WorldState, base_run_id: str, snapshot_year: int) -> None:
    world.events.append(
        Event(
            year=world.year,
            event_type=EventType.POLITICS,
            title="Counterfactual branch forked",
            description=f"This timeline forked from run {base_run_id} at year {snapshot_year}.",
            polity_ids=[polity.id for polity in world.polities[:2]],
            impact=0.0,
        )
    )


def _advance_local_with_snapshots(world: WorldState, steps: int, snapshots: list[WorldSnapshot]) -> None:
    engine = RelativisticCivilizationEngine(world.config)
    for index in range(steps):
        engine.step(world)
        if _should_capture_snapshot(world, index + 1, steps):
            snapshots.append(_snapshot_for_experiment(world))
    if not snapshots or snapshots[-1].year != world.year:
        snapshots.append(_snapshot_for_experiment(world))


def _counterfactual_branch(world: WorldState, snapshots: list[WorldSnapshot]) -> CounterfactualBranch:
    timeline = world.metrics
    peak_metric = max(timeline, key=lambda metric: metric.split_risk)
    first_split = next((metric.year for metric in timeline if metric.polities > 1), None)
    return CounterfactualBranch(
        run_id=world.run_id,
        final_metrics=timeline[-1],
        timeline=timeline,
        snapshots=snapshots,
        peak_split_risk=peak_metric.split_risk,
        year_of_first_split=first_split,
        dominant_risk_factor=_dominant_risk_factor(peak_metric.risk_breakdown),
    )


def _dominant_risk_factor(breakdown) -> str:
    values = {
        "command_pressure": breakdown.command_pressure,
        "delay_pressure": breakdown.delay_pressure,
        "unresolved_autonomy": breakdown.unresolved_autonomy,
        "loyalty_loss": breakdown.loyalty_loss,
    }
    return max(values, key=values.get)


def _causal_delta(original: CounterfactualBranch, counter: CounterfactualBranch) -> CausalDelta:
    split_delta = counter.final_metrics.split_risk - original.final_metrics.split_risk
    control_delta = counter.final_metrics.central_control - original.final_metrics.central_control
    peak_delta = counter.peak_split_risk - original.peak_split_risk
    escalation_delta = counter.final_metrics.cold_war.escalation_risk - original.final_metrics.cold_war.escalation_risk
    deterrence_delta = counter.final_metrics.cold_war.deterrence_stability - original.final_metrics.cold_war.deterrence_stability
    first_delta = (
        counter.year_of_first_split - original.year_of_first_split
        if counter.year_of_first_split is not None and original.year_of_first_split is not None
        else None
    )
    direction = "reduced" if split_delta < -0.01 else "increased" if split_delta > 0.01 else "left nearly unchanged"
    factor_before = original.dominant_risk_factor
    factor_after = counter.dominant_risk_factor
    if factor_after == "command_pressure" and split_delta > 0:
        interpretation = "The counterfactual increased command pressure and made centralized governance less stable."
    elif factor_before == "command_pressure" and split_delta < 0:
        interpretation = "The counterfactual reduced command pressure and improved frontier stability."
    elif factor_after != factor_before:
        interpretation = f"The dominant risk factor shifted from {factor_before} to {factor_after}, and split risk {direction}."
    else:
        interpretation = f"The dominant risk factor remained {factor_after}, and split risk {direction}."
    return CausalDelta(
        split_risk_delta=round(split_delta, 4),
        central_control_delta=round(control_delta, 4),
        first_split_year_delta=first_delta,
        peak_split_risk_delta=round(peak_delta, 4),
        escalation_risk_delta=round(escalation_delta, 4),
        deterrence_stability_delta=round(deterrence_delta, 4),
        dominant_risk_factor_before=factor_before,
        dominant_risk_factor_after=factor_after,
        interpretation=interpretation,
    )


def _summarize_sweep(parameter: str, runs: list[ExperimentRun]) -> ExperimentSummary:
    stable = min(runs, key=lambda run: (run.peak_split_risk, -run.final_metrics.central_control))
    risky = max(runs, key=lambda run: run.peak_split_risk)
    ordered = sorted(runs, key=lambda run: run.parameter_value)
    first = ordered[0]
    last = ordered[-1]
    delta = last.peak_split_risk - first.peak_split_risk
    if abs(delta) < 0.03:
        trend = f"{parameter} shows a flat split-risk response across this range."
    elif delta > 0:
        trend = f"Higher {parameter} increases peak split risk in this sweep."
    else:
        trend = f"Higher {parameter} reduces peak split risk in this sweep."
    recommendation = (
        f"Most stable value: {stable.parameter_value:.2f}. "
        f"Highest-risk value: {risky.parameter_value:.2f}. "
        "Compare this with central control and trade throughput before treating it as a policy optimum."
    )
    return ExperimentSummary(
        best_stability_value=stable.parameter_value,
        highest_split_risk_value=risky.parameter_value,
        dominant_trend=trend,
        recommendation=recommendation,
    )


def _advance_with_snapshots(world: WorldState, steps: int, include_snapshots: bool) -> WorldState:
    engine = RelativisticCivilizationEngine(world.config)
    for index in range(steps):
        engine.step(world)
        if include_snapshots and _should_capture_snapshot(world, index + 1, steps):
            store.add_snapshot(world)
    if include_snapshots:
        store.add_snapshot(world)
    return world


def _should_capture_snapshot(world: WorldState, step_index: int, total_steps: int) -> bool:
    has_major_event = any(event.event_type.value in {"colonization", "politics", "war"} for event in world.events)
    return world.year == 0 or world.year % 5 == 0 or step_index == total_steps or has_major_event


def _snapshot_for_experiment(world: WorldState) -> WorldSnapshot:
    return WorldSnapshot(
        year=world.year,
        systems=[system.model_copy(deep=True) for system in world.systems],
        polities=[polity.model_copy(deep=True) for polity in world.polities],
        fleets=[fleet.model_copy(deep=True) for fleet in world.fleets if not fleet.arrived],
        messages=[message.model_copy(deep=True) for message in world.messages if not message.delivered][-80:],
        trade_routes=[route.model_copy(deep=True) for route in world.trade_routes[:90]],
        events=[event.model_copy(deep=True) for event in world.events[-80:]],
        metrics=world.metrics[-1].model_copy(deep=True),
    )


@app.get("/api/report/{run_id}.md", response_class=PlainTextResponse)
def report(run_id: str) -> str:
    try:
        report_text = markdown_report(store.get(run_id))
        store.save_report(run_id, report_text)
        return report_text
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc


@app.get("/api/exports/{run_id}.csv")
def export_metrics(run_id: str) -> FileResponse:
    try:
        path = store.write_metrics_csv(store.get(run_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="simulation not found") from exc
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="export not available")
    return FileResponse(path, media_type="text/csv", filename=f"{run_id}-metrics.csv")


def summarize_world(world: WorldState) -> dict[str, object]:
    return {
        "run_id": world.run_id,
        "year": world.year,
        "config": world.config.model_dump(),
        "civilization": world.civilization.model_dump(),
        "systems": [system.model_dump() for system in world.systems],
        "polities": [polity.model_dump() for polity in world.polities],
        "fleets": [fleet.model_dump() for fleet in world.fleets[-80:]],
        "messages": [message.model_dump() for message in world.messages[-120:]],
        "trade_routes": [route.model_dump() for route in world.trade_routes],
        "war": world.war.model_dump(),
        "black_hole": world.black_hole.model_dump() if world.black_hole else None,
        "events": [event.model_dump(mode="json") for event in world.events[-100:]],
        "metrics": [metric.model_dump() for metric in world.metrics],
        "latest": world.metrics[-1].model_dump() if world.metrics else None,
    }
