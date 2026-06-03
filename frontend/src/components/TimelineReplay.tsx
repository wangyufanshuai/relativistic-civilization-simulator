import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { WorldSnapshot } from "../types/sim";

interface TimelineReplayProps {
  snapshots: WorldSnapshot[];
  index: number;
  playing: boolean;
  onChange: (index: number) => void;
  onTogglePlay: () => void;
  onLatest: () => void;
}

export function TimelineReplay({ snapshots, index, playing, onChange, onTogglePlay, onLatest }: TimelineReplayProps) {
  const active = snapshots[index];
  const latest = snapshots[snapshots.length - 1];
  return (
    <section className="timelineReplay">
      <div className="timelineHeader">
        <div>
          <span>timeline replay</span>
          <strong>{active ? `year ${active.year}` : "no snapshots"}</strong>
        </div>
        <div className="timelineButtons">
          <button onClick={onTogglePlay} disabled={snapshots.length < 2}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={() => onChange(Math.max(0, index - 1))} disabled={snapshots.length < 2 || index <= 0}>
            <SkipBack size={15} />
            Prev
          </button>
          <button onClick={() => onChange(Math.min(snapshots.length - 1, index + 1))} disabled={snapshots.length < 2 || index >= snapshots.length - 1}>
            <SkipForward size={15} />
            Next
          </button>
          <button onClick={onLatest} disabled={!latest}>
            <SkipForward size={15} />
            Latest
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, snapshots.length - 1)}
        value={Math.min(index, Math.max(0, snapshots.length - 1))}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={snapshots.length < 2}
      />
      <div className="timelineTicks">
        <span>{snapshots[0] ? `y${snapshots[0].year}` : "y--"}</span>
        <span>{latest ? `y${latest.year}` : "y--"}</span>
      </div>
    </section>
  );
}
