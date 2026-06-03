from __future__ import annotations

from typing import Any

from app.models import Assumption, AssumptionCoverage, CredibilityAudit, ResearchAuditKind, WorldState


ASSUMPTIONS_VERSION = "1.0"

ASSUMPTIONS: list[Assumption] = [
    Assumption(
        id="light_speed_delay",
        title="Light-speed communication delay",
        description="Interstellar commands, markets, warnings, and diplomacy propagate no faster than c = 1 ly/year.",
        applies_to=["run", "sweep", "counterfactual", "monte_carlo", "sensitivity"],
        related_metrics=["average_delay", "central_control", "split_risk"],
        limitations=["No faster-than-light signaling, wormholes, or quantum command channels are represented."],
    ),
    Assumption(
        id="centralization_pressure",
        title="Centralization creates command pressure",
        description="Highly centralized governance amplifies risk when frontier systems operate under long delays.",
        applies_to=["run", "sweep", "counterfactual", "monte_carlo", "sensitivity"],
        related_metrics=["central_control", "risk_breakdown.command_pressure", "split_risk"],
        limitations=["Political legitimacy, ideology, and institutions are compressed into rule parameters."],
    ),
    Assumption(
        id="autonomy_loyalty_dynamics",
        title="Autonomy and loyalty evolve locally",
        description="Colonies accumulate autonomy and lose loyalty when delayed directives fail to match local conditions.",
        applies_to=["run", "counterfactual", "monte_carlo", "sensitivity"],
        related_metrics=["autonomy", "risk_breakdown.unresolved_autonomy", "risk_breakdown.loyalty_loss"],
        limitations=["Culture, demography, and elite bargaining are not agent-modeled in detail."],
    ),
    Assumption(
        id="cold_war_deterrence",
        title="Relativistic cold-war deterrence is delay-sensitive",
        description="Fleet recall delay, militarization, and polity count shape first-strike pressure and escalation risk.",
        applies_to=["run", "sweep", "counterfactual", "monte_carlo", "sensitivity"],
        related_metrics=["cold_war.escalation_risk", "cold_war.deterrence_stability", "war_tension"],
        limitations=["Combat resolution is strategic and abstract, not a tactical battle simulator."],
    ),
    Assumption(
        id="black_hole_approximation",
        title="Black-hole frontier effects are strategic approximations",
        description="Black-hole zones alter research, trade, and communication risk without solving full GR field dynamics.",
        applies_to=["run", "sweep", "counterfactual"],
        related_metrics=["technology_diffusion", "trade_throughput", "average_delay"],
        limitations=["No numerical relativity, accretion physics, or full orbital mechanics are modeled."],
    ),
    Assumption(
        id="ai_narrative_only",
        title="AI is narrative-only",
        description="DeepSeek/OpenAI-compatible output can summarize runs but never changes simulation state or audit scores.",
        applies_to=["run", "sweep", "counterfactual", "monte_carlo", "sensitivity"],
        related_metrics=["none"],
        limitations=["Generated prose should be treated as explanation, not model evidence."],
    ),
]


def assumption_ids() -> list[str]:
    return [assumption.id for assumption in ASSUMPTIONS]


def audit_for_world(world: WorldState) -> CredibilityAudit:
    payload = {
        "scenario": world.config.scenario,
        "timeline": [metric.model_dump(mode="json") for metric in world.metrics],
        "final_metrics": world.metrics[-1].model_dump(mode="json"),
        "events": [event.model_dump(mode="json") for event in world.events[-30:]],
    }
    return credibility_audit("run", payload)


def credibility_audit(kind: ResearchAuditKind, payload: dict[str, Any] | None = None) -> CredibilityAudit:
    data = payload or {}
    score = _robustness_score(kind, data)
    coverage = [_coverage_for(assumption, kind, data) for assumption in ASSUMPTIONS]
    level = "strong_internal" if score >= 0.78 else "moderate" if score >= 0.52 else "exploratory"
    return CredibilityAudit(
        kind=kind,
        evidence_level=level,
        robustness_score=round(score, 4),
        assumption_coverage=coverage,
        primary_limitations=_limitations(kind, data),
        recommended_followups=_followups(kind, data),
        citation_summary=_citation_summary(kind, score, data),
    )


def audit_markdown(audit: CredibilityAudit) -> str:
    lines = [
        "## Assumptions & Credibility",
        f"- Evidence level: `{audit.evidence_level}`",
        f"- Internal robustness score: {audit.robustness_score:.2f}",
        f"- Citation summary: {audit.citation_summary}",
        "",
        "### Assumption Coverage",
    ]
    for item in audit.assumption_coverage:
        lines.append(f"- `{item.assumption_id}` ({item.status}): {item.rationale}")
    lines.extend(["", "### Primary Limitations"])
    lines.extend(f"- {item}" for item in audit.primary_limitations)
    lines.extend(["", "### Recommended Followups"])
    lines.extend(f"- {item}" for item in audit.recommended_followups)
    return "\n".join(lines)


def _robustness_score(kind: str, data: dict[str, Any]) -> float:
    if kind == "monte_carlo":
        seeds = data.get("seeds", [])
        seed_score = min(0.35, len(seeds) / 100 * 0.35) if isinstance(seeds, list) else 0
        runs = data.get("runs", [])
        outcome_score = 0.18 if isinstance(runs, list) and len(runs) >= 8 else 0.1
        return min(0.95, 0.42 + seed_score + outcome_score)
    if kind == "sensitivity":
        results = data.get("results", [])
        result_count = len(results) if isinstance(results, list) else 0
        confidence_hits = sum(1 for item in results if isinstance(item, dict) and item.get("confidence") in {"medium", "high"})
        return min(0.92, 0.48 + result_count * 0.06 + confidence_hits * 0.055)
    if kind == "sweep":
        runs = data.get("runs", [])
        run_count = len(runs) if isinstance(runs, list) else 0
        return min(0.72, 0.34 + run_count * 0.045)
    if kind == "counterfactual":
        has_delta = isinstance(data.get("delta"), dict)
        return 0.62 if has_delta else 0.46
    timeline = data.get("timeline", [])
    if isinstance(timeline, list):
        return min(0.5, 0.28 + len(timeline) / 1000)
    return 0.32


def _coverage_for(assumption: Assumption, kind: str, data: dict[str, Any]) -> AssumptionCoverage:
    if kind not in assumption.applies_to:
        return AssumptionCoverage(
            assumption_id=assumption.id,
            title=assumption.title,
            status="partial",
            rationale=f"This audit kind does not directly exercise {assumption.title.lower()}, but it remains part of the model background.",
        )
    metric_text = " ".join(assumption.related_metrics)
    status = "covered"
    if assumption.id == "black_hole_approximation" and "black_hole" not in str(data).lower():
        status = "partial"
    if assumption.id == "ai_narrative_only":
        status = "covered"
    return AssumptionCoverage(
        assumption_id=assumption.id,
        title=assumption.title,
        status=status,
        rationale=f"Audit references {metric_text} and treats the assumption as model-internal rather than externally validated.",
    )


def _limitations(kind: str, data: dict[str, Any]) -> list[str]:
    limits = [
        "Scores are internal robustness indicators, not empirical validation against real historical or astronomical data.",
        "The simulator uses strategic SR and approximate GR effects rather than full physical field equations.",
        "Civilization behavior is rule-based; no population-level social science calibration is included.",
    ]
    if kind == "run":
        limits.append("A single run cannot separate scenario effects from seed-specific history.")
    if kind in {"sweep", "counterfactual"}:
        limits.append("Parameter interactions can be nonlinear; follow-up Monte Carlo checks are required before strong claims.")
    if kind == "monte_carlo":
        limits.append("Seed variance estimates internal uncertainty but does not validate model assumptions.")
    if kind == "sensitivity":
        limits.append("Local perturbation sensitivity does not prove global parameter importance.")
    return limits


def _followups(kind: str, data: dict[str, Any]) -> list[str]:
    followups = [
        "Run at least one Monte Carlo batch for seed uncertainty.",
        "Pair high-impact parameter findings with a counterfactual fork around the first risk peak.",
    ]
    if kind == "run":
        followups.insert(0, "Promote the run into a sweep or sensitivity scan before treating conclusions as robust.")
    if kind == "sweep":
        followups.append("Repeat the sweep under federated and centralized scenarios to detect scenario dependence.")
    if kind == "monte_carlo":
        followups.append("Use sensitivity analysis to identify which assumptions drive cross-seed variance.")
    if kind == "sensitivity":
        strongest = data.get("summary", {}).get("strongest_parameter") if isinstance(data.get("summary"), dict) else None
        followups.append(f"Run a focused sweep around `{strongest or 'the strongest parameter'}` with finer parameter spacing.")
    return followups


def _citation_summary(kind: str, score: float, data: dict[str, Any]) -> str:
    level = "strong internal" if score >= 0.78 else "moderate internal" if score >= 0.52 else "exploratory"
    scenario = data.get("scenario", "unknown scenario")
    return (
        f"{kind} evidence for `{scenario}` is {level}; cite as deterministic model-internal evidence, "
        "not as an externally calibrated prediction."
    )
