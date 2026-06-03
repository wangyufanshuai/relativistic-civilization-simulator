import json
from pathlib import Path

from app.main import app


def test_openapi_contract_snapshot_is_current() -> None:
    project_root = Path(__file__).resolve().parents[2]
    snapshot_path = project_root / "docs" / "openapi.json"
    committed = json.loads(snapshot_path.read_text(encoding="utf-8"))
    current = json.loads(json.dumps(app.openapi(), sort_keys=True))
    assert committed == current


def test_openapi_contract_includes_public_routes() -> None:
    paths = set(app.openapi()["paths"])
    expected = {
        "/api/health",
        "/api/diagnostics",
        "/api/scenarios",
        "/api/research/assumptions",
        "/api/research/audit",
        "/api/simulations/start",
        "/api/simulations/step",
        "/api/simulations/run",
        "/api/simulations/fork",
        "/api/simulations/{run_id}/state",
        "/api/simulations/{run_id}/metrics",
        "/api/simulations/{run_id}/events",
        "/api/simulations/{run_id}/snapshots",
        "/api/archive/runs",
        "/api/archive/runs/{run_id}",
        "/api/archive/runs/{run_id}/snapshots",
        "/api/archive/runs/{run_id}/report.md",
        "/api/archive/runs/{run_id}/manifest.json",
        "/api/archive/runs/{run_id}/pin",
        "/api/archive/runs/{run_id}/unpin",
        "/api/experiments/compare",
        "/api/experiments/sweep",
        "/api/experiments/counterfactual",
        "/api/experiments/monte-carlo",
        "/api/experiments/sensitivity",
        "/api/experiments/report",
        "/api/ai/chronicle",
        "/api/report/{run_id}.md",
        "/api/exports/{run_id}.csv",
        "/api/exports/{run_id}.manifest.json",
    }
    assert expected <= paths
