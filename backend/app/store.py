from __future__ import annotations

import csv
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from app.models import ArchivedRun, ArchiveRunDetail, WorldSnapshot, WorldState


class SimulationStore:
    def __init__(self) -> None:
        self._worlds: dict[str, WorldState] = {}
        self._snapshots: dict[str, list[WorldSnapshot]] = {}
        self.data_root = Path(__file__).resolve().parents[2] / "data" / "runs"
        self.data_root.mkdir(parents=True, exist_ok=True)
        self.db_path = Path(__file__).resolve().parents[2] / "data" / "archive.sqlite"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def put(self, world: WorldState) -> WorldState:
        self._worlds[world.run_id] = world
        self.archive_world(world)
        return world

    def get(self, run_id: str) -> WorldState:
        if run_id not in self._worlds:
            self._worlds[run_id] = self._load_world(run_id)
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
        self.archive_snapshot(world.run_id, snapshot)
        return snapshot

    def snapshots(self, run_id: str) -> list[WorldSnapshot]:
        if run_id not in self._snapshots:
            self._snapshots[run_id] = self._load_snapshots(run_id)
        return self._snapshots[run_id]

    def replace_snapshots(self, run_id: str, snapshots: list[WorldSnapshot]) -> None:
        self._snapshots[run_id] = snapshots
        with self._connect() as db:
            db.execute("DELETE FROM snapshots WHERE run_id = ?", (run_id,))
            for snapshot in snapshots:
                db.execute(
                    "INSERT OR REPLACE INTO snapshots (run_id, year, snapshot_json) VALUES (?, ?, ?)",
                    (run_id, snapshot.year, snapshot.model_dump_json()),
                )
            db.execute("UPDATE runs SET snapshot_count = ?, updated_at = ? WHERE run_id = ?", (len(snapshots), _now(), run_id))

    def list_archive(self) -> list[ArchivedRun]:
        with self._connect() as db:
            rows = db.execute(
                """
                SELECT run_id, scenario, year, created_at, updated_at, pinned, state_json, final_metrics_json,
                       config_json, event_count, snapshot_count, report_text
                FROM runs
                ORDER BY pinned DESC, updated_at DESC
                """
            ).fetchall()
        return [self._archived_run_from_row(row) for row in rows]

    def archive_detail(self, run_id: str) -> ArchiveRunDetail:
        world = self.get(run_id)
        snapshots = self.snapshots(run_id)
        summary = self.archive_summary(run_id)
        return ArchiveRunDetail(
            summary=summary,
            state=world,
            metrics=world.metrics,
            events=world.events,
            snapshots=snapshots,
        )

    def archive_summary(self, run_id: str) -> ArchivedRun:
        with self._connect() as db:
            row = db.execute(
                """
                SELECT run_id, scenario, year, created_at, updated_at, pinned, state_json, final_metrics_json,
                       config_json, event_count, snapshot_count, report_text
                FROM runs WHERE run_id = ?
                """,
                (run_id,),
            ).fetchone()
        if row is None:
            raise KeyError(run_id)
        return self._archived_run_from_row(row)

    def delete_archive(self, run_id: str) -> None:
        with self._connect() as db:
            cursor = db.execute("DELETE FROM runs WHERE run_id = ?", (run_id,))
            db.execute("DELETE FROM snapshots WHERE run_id = ?", (run_id,))
        self._worlds.pop(run_id, None)
        self._snapshots.pop(run_id, None)
        if cursor.rowcount == 0:
            raise KeyError(run_id)

    def set_pinned(self, run_id: str, pinned: bool) -> ArchivedRun:
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE runs SET pinned = ?, updated_at = ? WHERE run_id = ?",
                (1 if pinned else 0, _now(), run_id),
            )
        if cursor.rowcount == 0:
            raise KeyError(run_id)
        return self.archive_summary(run_id)

    def save_report(self, run_id: str, report_text: str) -> None:
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE runs SET report_text = ?, updated_at = ? WHERE run_id = ?",
                (report_text, _now(), run_id),
            )
        if cursor.rowcount == 0:
            raise KeyError(run_id)

    def report(self, run_id: str) -> str:
        with self._connect() as db:
            row = db.execute("SELECT report_text FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return row["report_text"] or ""

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

    def archive_world(self, world: WorldState) -> None:
        latest = world.metrics[-1]
        timestamp = _now()
        with self._connect() as db:
            existing = db.execute("SELECT created_at, pinned, report_text FROM runs WHERE run_id = ?", (world.run_id,)).fetchone()
            db.execute(
                """
                INSERT INTO runs (
                    run_id, scenario, year, created_at, updated_at, pinned, config_json, state_json,
                    final_metrics_json, event_count, snapshot_count, report_text
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    scenario = excluded.scenario,
                    year = excluded.year,
                    updated_at = excluded.updated_at,
                    config_json = excluded.config_json,
                    state_json = excluded.state_json,
                    final_metrics_json = excluded.final_metrics_json,
                    event_count = excluded.event_count,
                    snapshot_count = excluded.snapshot_count,
                    report_text = COALESCE(runs.report_text, excluded.report_text)
                """
                ,
                (
                    world.run_id,
                    world.config.scenario,
                    world.year,
                    existing["created_at"] if existing else timestamp,
                    timestamp,
                    existing["pinned"] if existing else 0,
                    world.config.model_dump_json(),
                    world.model_dump_json(),
                    latest.model_dump_json(),
                    len(world.events),
                    len(self._snapshots.get(world.run_id, [])),
                    existing["report_text"] if existing else None,
                ),
            )

    def archive_snapshot(self, run_id: str, snapshot: WorldSnapshot) -> None:
        with self._connect() as db:
            db.execute(
                "INSERT OR REPLACE INTO snapshots (run_id, year, snapshot_json) VALUES (?, ?, ?)",
                (run_id, snapshot.year, snapshot.model_dump_json()),
            )
            count = db.execute("SELECT COUNT(*) AS count FROM snapshots WHERE run_id = ?", (run_id,)).fetchone()["count"]
            db.execute("UPDATE runs SET snapshot_count = ?, updated_at = ? WHERE run_id = ?", (count, _now(), run_id))

    def _init_db(self) -> None:
        with self._connect() as db:
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY,
                    scenario TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    pinned INTEGER NOT NULL DEFAULT 0,
                    config_json TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    final_metrics_json TEXT NOT NULL,
                    event_count INTEGER NOT NULL DEFAULT 0,
                    snapshot_count INTEGER NOT NULL DEFAULT 0,
                    report_text TEXT
                )
                """
            )
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS snapshots (
                    run_id TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    snapshot_json TEXT NOT NULL,
                    PRIMARY KEY (run_id, year),
                    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.db_path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        return db

    def _load_world(self, run_id: str) -> WorldState:
        with self._connect() as db:
            row = db.execute("SELECT state_json FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return WorldState.model_validate_json(row["state_json"])

    def _load_snapshots(self, run_id: str) -> list[WorldSnapshot]:
        with self._connect() as db:
            rows = db.execute("SELECT snapshot_json FROM snapshots WHERE run_id = ? ORDER BY year", (run_id,)).fetchall()
        if not rows:
            self.archive_summary(run_id)
        return [WorldSnapshot.model_validate_json(row["snapshot_json"]) for row in rows]

    def _archived_run_from_row(self, row: sqlite3.Row) -> ArchivedRun:
        return ArchivedRun(
            run_id=row["run_id"],
            scenario=row["scenario"],
            year=row["year"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            pinned=bool(row["pinned"]),
            final_metrics=WorldState.model_validate_json(row["state_json"]).metrics[-1],
            config=WorldState.model_validate_json(row["state_json"]).config,
            event_count=row["event_count"],
            snapshot_count=row["snapshot_count"],
            report_available=bool(row["report_text"]),
        )


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


store = SimulationStore()
