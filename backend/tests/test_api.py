from fastapi.testclient import TestClient

from app.main import app
from app.store import SimulationStore


client = TestClient(app)


def test_api_simulation_flow_and_exports() -> None:
    assert client.get("/api/health").json()["status"] == "ok"
    scenarios = client.get("/api/scenarios").json()
    assert {scenario["id"] for scenario in scenarios} >= {"baseline_empire", "federated_network"}

    started = client.post("/api/simulations/start", json={"scenario": "baseline_empire", "seed": 11}).json()
    run_id = started["run_id"]
    stepped = client.post("/api/simulations/step", json={"run_id": run_id, "steps": 5}).json()
    assert stepped["year"] == 5
    assert stepped["latest"]["colonized_systems"] >= 1
    assert stepped["latest"]["risk_breakdown"]["total_split_risk"] == stepped["latest"]["split_risk"]
    assert "cold_war" in stepped["latest"]
    assert {"deterrence_stability", "first_strike_pressure", "recall_delay", "escalation_risk", "frontier_militarization"} <= set(
        stepped["latest"]["cold_war"]
    )
    assert client.get(f"/api/simulations/{run_id}/state").json()["run_id"] == run_id
    assert len(client.get(f"/api/simulations/{run_id}/metrics").json()) >= 6
    assert isinstance(client.get(f"/api/simulations/{run_id}/events").json(), list)
    snapshots = client.get(f"/api/simulations/{run_id}/snapshots").json()
    assert snapshots[0]["year"] == 0
    assert snapshots[-1]["year"] == 5
    assert {"systems", "polities", "fleets", "messages", "events", "metrics"} <= set(snapshots[-1])
    assert client.get(f"/api/report/{run_id}.md").text.startswith("# Relativistic Civilization Report")
    assert client.get(f"/api/exports/{run_id}.csv").status_code == 200
    assert client.post("/api/ai/chronicle", json={"run_id": run_id}).json()["provider"] in {"offline", "configured"}


def test_api_invalid_run_id_returns_404() -> None:
    assert client.get("/api/simulations/missing/state").status_code == 404
    assert client.post("/api/simulations/step", json={"run_id": "missing", "steps": 1}).status_code == 404
    assert client.get("/api/simulations/missing/snapshots").status_code == 404


def test_compare_endpoint_runs_scenarios() -> None:
    response = client.get("/api/experiments/compare", params={"steps": 20, "seed": 5})
    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 6
    assert "central_control" in body[0]


def test_sweep_endpoint_returns_runs_and_summary() -> None:
    payload = {
        "scenario": "baseline_empire",
        "parameter": "centralization",
        "values": [0.2, 0.5, 0.8],
        "steps": 80,
        "seed": 13,
    }
    response = client.post("/api/experiments/sweep", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["scenario"] == "baseline_empire"
    assert body["parameter"] == "centralization"
    assert len(body["runs"]) == 3
    assert "dominant_trend" in body["summary"]
    assert "recommendation" in body["summary"]
    assert body["runs"][0]["timeline"]
    assert "peak_split_risk" in body["runs"][0]
    assert "peak_risk_breakdown" in body["runs"][0]
    assert "year_of_first_split" in body["runs"][0]
    assert "max_polities" in body["runs"][0]
    assert "average_trade_throughput" in body["runs"][0]


def test_sweep_is_deterministic() -> None:
    payload = {
        "scenario": "centralized_command",
        "parameter": "ship_velocity_c",
        "values": [0.25, 0.55, 0.85],
        "steps": 60,
        "seed": 17,
    }
    first = client.post("/api/experiments/sweep", json=payload).json()
    second = client.post("/api/experiments/sweep", json=payload).json()
    assert first == second


def test_sweep_rejects_invalid_parameter_and_range() -> None:
    invalid_parameter = client.post(
        "/api/experiments/sweep",
        json={"scenario": "baseline_empire", "parameter": "resources", "values": [0.1, 0.2]},
    )
    assert invalid_parameter.status_code == 422
    invalid_range = client.post(
        "/api/experiments/sweep",
        json={"scenario": "baseline_empire", "parameter": "ship_velocity_c", "values": [0.2, 1.2]},
    )
    assert invalid_range.status_code == 422


def test_centralization_sweep_high_value_has_more_split_pressure() -> None:
    body = client.post(
        "/api/experiments/sweep",
        json={
            "scenario": "baseline_empire",
            "parameter": "centralization",
            "values": [0.2, 0.85],
            "steps": 140,
            "seed": 7,
        },
    ).json()
    low, high = body["runs"]
    assert high["peak_split_risk"] > low["peak_split_risk"]


def test_run_snapshots_include_event_and_interval_years() -> None:
    body = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 19, "steps": 80, "include_snapshots": True},
    ).json()
    snapshots = client.get(f"/api/simulations/{body['run_id']}/snapshots").json()
    years = {snapshot["year"] for snapshot in snapshots}
    assert {0, 5, 10, 15, 20, 25, 30, 35, 40, 80} <= years
    assert snapshots[-1]["year"] == 80


def test_risk_breakdown_pressure_terms_respond_to_parameters() -> None:
    low = client.post(
        "/api/experiments/sweep",
        json={
            "scenario": "baseline_empire",
            "parameter": "centralization",
            "values": [0.2, 0.85],
            "steps": 80,
            "seed": 7,
        },
    ).json()["runs"]
    assert low[1]["final_metrics"]["risk_breakdown"]["command_pressure"] > low[0]["final_metrics"]["risk_breakdown"]["command_pressure"]

    early = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 23, "steps": 20, "include_snapshots": False},
    ).json()["latest"]
    late = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 23, "steps": 140, "include_snapshots": False},
    ).json()["latest"]
    assert late["average_delay"] >= early["average_delay"]
    assert late["risk_breakdown"]["delay_pressure"] >= early["risk_breakdown"]["delay_pressure"]


def test_fork_from_snapshot_creates_new_run_and_preserves_original() -> None:
    base = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 31, "steps": 60, "include_snapshots": True},
    ).json()
    fork = client.post(
        "/api/simulations/fork",
        json={
            "run_id": base["run_id"],
            "snapshot_year": 37,
            "steps": 20,
            "overrides": {"centralization": 0.25},
        },
    ).json()
    assert fork["run_id"] != base["run_id"]
    assert client.get(f"/api/simulations/{base['run_id']}/state").json()["year"] == 60
    fork_snapshots = client.get(f"/api/simulations/{fork['run_id']}/snapshots").json()
    assert fork_snapshots[0]["year"] == 35
    assert any(event["title"] == "Counterfactual branch forked" for event in fork_snapshots[0]["events"])
    assert any(event["title"] == "Counterfactual branch forked" for event in fork["events"])


def test_fork_rejects_missing_run_and_invalid_override() -> None:
    assert client.post(
        "/api/simulations/fork",
        json={"run_id": "missing", "snapshot_year": 20, "steps": 10, "overrides": {"centralization": 0.4}},
    ).status_code == 404
    base = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 32, "steps": 20, "include_snapshots": True},
    ).json()
    invalid = client.post(
        "/api/simulations/fork",
        json={"run_id": base["run_id"], "snapshot_year": 10, "steps": 10, "overrides": {"resources": 999}},
    )
    assert invalid.status_code == 422


def test_counterfactual_returns_branches_delta_and_report() -> None:
    base = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 33, "steps": 80, "include_snapshots": True},
    ).json()
    body = client.post(
        "/api/experiments/counterfactual",
        json={
            "run_id": base["run_id"],
            "snapshot_year": 40,
            "steps": 50,
            "overrides": {"centralization": 0.22},
        },
    ).json()
    assert body["base_run_id"] == base["run_id"]
    assert body["fork_run_id"] != base["run_id"]
    assert body["snapshot_year"] == 40
    assert body["original"]["timeline"]
    assert body["counterfactual"]["timeline"]
    assert "split_risk_delta" in body["delta"]
    assert "escalation_risk_delta" in body["delta"]
    assert "deterrence_stability_delta" in body["delta"]
    assert "dominant_risk_factor_before" in body["delta"]
    assert body["summary"]
    report = client.post("/api/experiments/report", json={"kind": "counterfactual", "payload": body}).json()
    assert "# Counterfactual Governance Report" in report["markdown"]
    assert "Fork year" in report["markdown"]
    assert "Risk Factors" in report["markdown"]
    assert "Cold War" in report["markdown"]


def test_lower_centralization_counterfactual_lowers_command_pressure() -> None:
    base = client.post(
        "/api/simulations/run",
        json={"scenario": "centralized_command", "seed": 34, "steps": 90, "include_snapshots": True},
    ).json()
    body = client.post(
        "/api/experiments/counterfactual",
        json={
            "run_id": base["run_id"],
            "snapshot_year": 45,
            "steps": 40,
            "overrides": {"centralization": 0.2},
        },
    ).json()
    original_command = body["original"]["final_metrics"]["risk_breakdown"]["command_pressure"]
    counter_command = body["counterfactual"]["final_metrics"]["risk_breakdown"]["command_pressure"]
    assert counter_command < original_command


def test_fork_with_same_inputs_is_deterministic_except_run_id() -> None:
    base = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 35, "steps": 60, "include_snapshots": True},
    ).json()
    payload = {
        "run_id": base["run_id"],
        "snapshot_year": 30,
        "steps": 25,
        "overrides": {"ship_velocity_c": 0.62},
    }
    first = client.post("/api/simulations/fork", json=payload).json()
    second = client.post("/api/simulations/fork", json=payload).json()
    assert first["latest"] == second["latest"]
    assert first["metrics"] == second["metrics"]


def test_archive_persists_run_snapshots_and_report() -> None:
    body = client.post(
        "/api/simulations/run",
        json={"scenario": "baseline_empire", "seed": 51, "steps": 30, "include_snapshots": True},
    ).json()
    run_id = body["run_id"]
    listing = client.get("/api/archive/runs").json()
    archived = next(item for item in listing if item["run_id"] == run_id)
    assert archived["scenario"] == "baseline_empire"
    assert archived["snapshot_count"] >= 2
    assert archived["final_metrics"]["cold_war"]

    detail = client.get(f"/api/archive/runs/{run_id}").json()
    assert detail["state"]["run_id"] == run_id
    assert detail["snapshots"][0]["year"] == 0
    assert detail["metrics"][-1]["year"] == 30

    fresh_store = SimulationStore()
    assert fresh_store.get(run_id).run_id == run_id
    assert fresh_store.snapshots(run_id)[-1].year == 30

    report = client.get(f"/api/archive/runs/{run_id}/report.md")
    assert report.status_code == 200
    assert report.text.startswith("# Relativistic Civilization Report")
    assert client.get("/api/archive/runs").json()[0]["report_available"] in {True, False}


def test_archive_pin_sort_and_delete() -> None:
    first = client.post(
        "/api/simulations/run",
        json={"scenario": "slow_ships", "seed": 52, "steps": 10, "include_snapshots": True},
    ).json()["run_id"]
    second = client.post(
        "/api/simulations/run",
        json={"scenario": "federated_network", "seed": 53, "steps": 10, "include_snapshots": True},
    ).json()["run_id"]

    pinned = client.post(f"/api/archive/runs/{first}/pin")
    assert pinned.status_code == 200
    listing = client.get("/api/archive/runs").json()
    assert listing[0]["run_id"] == first
    assert listing[0]["pinned"] is True

    assert client.post(f"/api/archive/runs/{first}/unpin").json()["pinned"] is False
    assert client.delete(f"/api/archive/runs/{second}").status_code == 200
    assert client.get(f"/api/archive/runs/{second}").status_code == 404
    assert client.get("/api/archive/runs/missing").status_code == 404


def test_monte_carlo_returns_seed_runs_and_confidence_intervals() -> None:
    payload = {"scenario": "baseline_empire", "seeds": [61, 62, 63, 64], "steps": 40}
    body = client.post("/api/experiments/monte-carlo", json=payload).json()
    assert body["scenario"] == "baseline_empire"
    assert body["seeds"] == [61, 62, 63, 64]
    assert len(body["runs"]) == 4
    assert "final_metrics" in body["runs"][0]
    assert {"mean", "stddev", "ci95_low", "ci95_high"} <= set(body["summary"]["split_risk"])
    assert 0 <= body["summary"]["split_probability"] <= 1
    assert body["summary"]["interpretation"]


def test_monte_carlo_is_deterministic() -> None:
    payload = {"scenario": "centralized_command", "seeds": [65, 66, 67, 68], "steps": 35}
    first = client.post("/api/experiments/monte-carlo", json=payload).json()
    second = client.post("/api/experiments/monte-carlo", json=payload).json()
    assert first == second


def test_monte_carlo_rejects_too_few_seeds() -> None:
    response = client.post("/api/experiments/monte-carlo", json={"scenario": "baseline_empire", "seeds": [1, 2], "steps": 20})
    assert response.status_code == 422


def test_sensitivity_returns_ranked_parameter_effects_and_report() -> None:
    payload = {
        "scenario": "baseline_empire",
        "parameters": ["centralization", "federation_bias"],
        "steps": 35,
        "seed_start": 70,
        "seed_count": 4,
        "perturbation": 0.2,
    }
    body = client.post("/api/experiments/sensitivity", json=payload).json()
    assert body["scenario"] == "baseline_empire"
    assert body["seeds"] == [70, 71, 72, 73]
    assert len(body["results"]) == 2
    assert body["results"][0]["sensitivity_score"] >= body["results"][1]["sensitivity_score"]
    assert {"split_risk_low", "split_risk_baseline", "split_risk_high"} <= set(body["results"][0])
    assert body["summary"]["strongest_parameter"] in {"centralization", "federation_bias"}
    report = client.post("/api/experiments/report", json={"kind": "sensitivity", "payload": body}).json()
    assert "# Model Sensitivity Report" in report["markdown"]
    assert "Parameter Effects" in report["markdown"]


def test_sensitivity_is_deterministic_and_rejects_invalid_parameter() -> None:
    payload = {
        "scenario": "centralized_command",
        "parameters": ["centralization", "ship_velocity_c"],
        "steps": 30,
        "seed_start": 80,
        "seed_count": 3,
    }
    first = client.post("/api/experiments/sensitivity", json=payload).json()
    second = client.post("/api/experiments/sensitivity", json=payload).json()
    assert first == second
    invalid = client.post(
        "/api/experiments/sensitivity",
        json={"scenario": "baseline_empire", "parameters": ["resources"], "steps": 20, "seed_count": 3},
    )
    assert invalid.status_code == 422
