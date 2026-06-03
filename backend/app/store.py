from __future__ import annotations

import csv
from pathlib import Path

from app.models import WorldSnapshot, WorldState


class SimulationStore:
    def __init__(self) -> None:
        self._worlds: dict[str, WorldState] = {}
        self._snapshots: dict[str, list[WorldSnapshot]] = {}
        self.data_root = Path(__file__).resolve().parents[2] / "data" / "runs"
        self.data_root.mkdir(parents=True, exist_ok=True)

    def put(self, world: WorldState) -> WorldState:
        self._worlds[world.run_id] = world
        return world

    def get(self, run_id: str) -> WorldState:
        return self._worlds[run_id]

    def reset_snapshots(self, world: WorldState) -> None:
        self._snapshots[world.run_id] = []

    def add_snapshot(self, world: WorldState) -> WorldSnapshot:
        snapshot = WorldSnapshot(
            year=world.year,
            systems=[system.model_copy(deep=True) for system in world.systems],
            polities=[polity.model_copy(deep=True) for polity in world.polities],
            fleets=[fleet.model_copy(deep=True) for fleet in world.fleets if not fleet.arrived],
            messages=[message.model_copy(deep=True) for message in world.messages if not message.delivered][-80:],
            trade_routes=[route.model_copy(deep=True) for route in world.trade_routes[:90]],
            events=[event.model_copy(deep=True) for event in world.events[-80:]],
            metrics=world.metrics[-1].model_copy(deep=True),
        )
        snapshots = self._snapshots.setdefault(world.run_id, [])
        if snapshots and snapshots[-1].year == snapshot.year:
            snapshots[-1] = snapshot
        else:
            snapshots.append(snapshot)
        return snapshot

    def snapshots(self, run_id: str) -> list[WorldSnapshot]:
        return self._snapshots[run_id]

    def write_metrics_csv(self, world: WorldState) -> Path:
        run_dir = self.data_root / world.run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        path = run_dir / "metrics.csv"
        rows = [metric.model_dump() for metric in world.metrics]
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else ["year"])
            writer.writeheader()
            writer.writerows(rows)
        return path


store = SimulationStore()
