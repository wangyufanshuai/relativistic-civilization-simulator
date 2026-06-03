from __future__ import annotations

import httpx

from app.llm_client import generate_chronicle


def _payload() -> dict[str, object]:
    return {
        "run_id": "run-test",
        "scenario": "baseline_empire",
        "year": 80,
        "latest_metrics": {
            "central_control": 0.42,
            "average_delay": 18.5,
            "split_risk": 0.71,
            "cold_war": {"escalation_risk": 0.33},
        },
        "recent_events": [{"year": 75, "title": "Frontier autonomy surge"}],
    }


def test_chronicle_offline_without_key(monkeypatch) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    result = generate_chronicle(_payload())

    assert result["provider"] == "offline"
    assert "central control" in result["chronicle"]
    assert "0.33" in result["chronicle"]


def test_chronicle_calls_deepseek_compatible_endpoint(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    class Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"choices": [{"message": {"content": "A concise generated chronicle."}}]}

    def fake_post(url: str, **kwargs):
        calls.append({"url": url, **kwargs})
        return Response()

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://example.test/v1/")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-test")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(httpx, "post", fake_post)

    result = generate_chronicle(_payload())

    assert result == {"provider": "deepseek", "model": "deepseek-test", "chronicle": "A concise generated chronicle."}
    assert calls[0]["url"] == "https://example.test/v1/chat/completions"
    assert calls[0]["json"]["model"] == "deepseek-test"
    assert calls[0]["headers"]["Authorization"] == "Bearer test-key"


def test_chronicle_provider_failure_returns_guarded_fallback(monkeypatch) -> None:
    def fake_post(*_args, **_kwargs):
        raise httpx.TimeoutException("slow provider")

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "post", fake_post)

    result = generate_chronicle(_payload())

    assert result["provider"] == "error"
    assert result["model"] == "deepseek-chat"
    assert "chronicle failed" in result["chronicle"]
    assert "simulation remains deterministic" in result["chronicle"]
