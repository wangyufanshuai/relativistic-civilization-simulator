from __future__ import annotations

import os


def generate_chronicle(payload: dict[str, object]) -> dict[str, object]:
    if not (os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")):
        metrics = payload.get("latest_metrics", {})
        return {
            "provider": "offline",
            "chronicle": (
                "No AI provider key is configured. Offline chronicle: the simulation remains deterministic; "
                f"central control is {metrics.get('central_control', 'n/a')}, average delay is "
                f"{metrics.get('average_delay', 'n/a')} years, and split risk is {metrics.get('split_risk', 'n/a')}."
            ),
        }
    return {
        "provider": "configured",
        "chronicle": "AI provider is configured, but the MVP keeps narrative generation as a guarded optional adapter.",
    }

