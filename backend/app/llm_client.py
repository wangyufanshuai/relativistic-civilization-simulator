from __future__ import annotations

import json
import os

import httpx


DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"


def generate_chronicle(payload: dict[str, object]) -> dict[str, object]:
    provider = _provider_config()
    if not provider:
        return {
            "provider": "offline",
            "chronicle": _offline_chronicle(payload, "No AI provider key is configured."),
        }

    name, api_key, base_url, model = provider
    try:
        content = _request_chronicle(payload, api_key=api_key, base_url=base_url, model=model)
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        return {
            "provider": "error",
            "model": model,
            "chronicle": _offline_chronicle(payload, f"{name} chronicle failed: {exc.__class__.__name__}."),
        }

    return {"provider": name, "model": model, "chronicle": content}


def _provider_config() -> tuple[str, str, str, str] | None:
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    if deepseek_key:
        return (
            "deepseek",
            deepseek_key,
            os.getenv("DEEPSEEK_BASE_URL", DEFAULT_DEEPSEEK_BASE_URL).rstrip("/"),
            os.getenv("DEEPSEEK_MODEL", DEFAULT_DEEPSEEK_MODEL),
        )

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        return (
            "openai",
            openai_key,
            os.getenv("OPENAI_BASE_URL", DEFAULT_OPENAI_BASE_URL).rstrip("/"),
            os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
        )
    return None


def _request_chronicle(payload: dict[str, object], *, api_key: str, base_url: str, model: str) -> str:
    timeout = float(os.getenv("AI_CHRONICLE_TIMEOUT_SECONDS", "20"))
    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.35,
            "max_tokens": 420,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You write concise research chronicle notes for a deterministic relativistic civilization "
                        "simulator. Do not claim the model is physically validated. Focus on governance, light-delay, "
                        "split risk, trade, and cold-war dynamics. Return 2 short paragraphs in English."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(_compact_payload(payload), ensure_ascii=True),
                },
            ],
        },
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise ValueError("empty chronicle response")
    return content.strip()


def _compact_payload(payload: dict[str, object]) -> dict[str, object]:
    metrics = payload.get("latest_metrics", {})
    events = payload.get("recent_events", [])
    if isinstance(events, list):
        events = events[-8:]
    return {
        "run_id": payload.get("run_id"),
        "scenario": payload.get("scenario"),
        "year": payload.get("year"),
        "latest_metrics": metrics,
        "recent_events": events,
    }


def _offline_chronicle(payload: dict[str, object], reason: str) -> str:
    metrics = payload.get("latest_metrics", {})
    if not isinstance(metrics, dict):
        metrics = {}
    return (
        f"{reason} Offline chronicle: the simulation remains deterministic; central control is "
        f"{metrics.get('central_control', 'n/a')}, average delay is {metrics.get('average_delay', 'n/a')} years, "
        f"split risk is {metrics.get('split_risk', 'n/a')}, and cold-war escalation risk is "
        f"{_cold_war_value(metrics)}."
    )


def _cold_war_value(metrics: dict[str, object]) -> object:
    cold_war = metrics.get("cold_war", {})
    if isinstance(cold_war, dict):
        return cold_war.get("escalation_risk", "n/a")
    return "n/a"
