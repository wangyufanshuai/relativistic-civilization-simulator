from __future__ import annotations

from typing import Any

from app.models import WorldState


def markdown_report(world: WorldState) -> str:
    latest = world.metrics[-1]
    lines = [
        f"# Relativistic Civilization Report: {world.run_id}",
        "",
        f"- Scenario: `{world.config.scenario}`",
        f"- Year: {world.year}",
        f"- Colonized systems: {latest.colonized_systems}",
        f"- Polities: {latest.polities}",
        f"- Central control: {latest.central_control:.2f}",
        f"- Average light delay: {latest.average_delay:.1f} years",
        f"- Autonomy: {latest.autonomy:.2f}",
        f"- Split risk: {latest.split_risk:.2f}",
        f"- Trade throughput: {latest.trade_throughput:.2f}",
        f"- War tension: {latest.war_tension:.2f}",
        f"- Cold war escalation risk: {latest.cold_war.escalation_risk:.2f}",
        f"- Deterrence stability: {latest.cold_war.deterrence_stability:.2f}",
        "",
        "## Polity Traits",
    ]
    trait_counts: dict[str, int] = {}
    for polity in world.polities:
        trait_counts[polity.trait.value] = trait_counts.get(polity.trait.value, 0) + 1
    for trait, count in sorted(trait_counts.items()):
        lines.append(f"- `{trait}`: {count}")
    lines.extend(
        [
            "",
            "## Recent Events",
        ]
    )
    for event in world.events[-20:]:
        lines.append(f"- **{event.year}** {event.title}: {event.description}")
    return "\n".join(lines) + "\n"


def experiment_report(kind: str, payload: dict[str, Any]) -> str:
    if kind == "counterfactual":
        delta = payload.get("delta", {})
        original = payload.get("original", {})
        counterfactual = payload.get("counterfactual", {})
        overrides = payload.get("overrides", {})
        lines = [
            "# Counterfactual Governance Report",
            "",
            "## Experiment Setup",
            f"- Base run: `{payload.get('base_run_id', 'unknown')}`",
            f"- Fork run: `{payload.get('fork_run_id', 'unknown')}`",
            f"- Fork year: {payload.get('snapshot_year', 'unknown')}",
            f"- Overrides: `{overrides}`",
            "",
            "## Key Results",
            f"- Original final split risk: {_branch_metric(original, 'split_risk')}",
            f"- Counterfactual final split risk: {_branch_metric(counterfactual, 'split_risk')}",
            f"- Split risk delta: {delta.get('split_risk_delta', 'unknown')}",
            f"- Central control delta: {delta.get('central_control_delta', 'unknown')}",
            f"- Peak split risk delta: {delta.get('peak_split_risk_delta', 'unknown')}",
            f"- First split year delta: {delta.get('first_split_year_delta', 'none')}",
            f"- Escalation risk delta: {delta.get('escalation_risk_delta', 'unknown')}",
            f"- Deterrence stability delta: {delta.get('deterrence_stability_delta', 'unknown')}",
            "",
            "## Risk Factors",
            f"- Original dominant factor: {delta.get('dominant_risk_factor_before', 'unknown')}",
            f"- Counterfactual dominant factor: {delta.get('dominant_risk_factor_after', 'unknown')}",
            "",
            "## Cold War",
            f"- Original escalation risk: {_branch_cold_war(original, 'escalation_risk')}",
            f"- Counterfactual escalation risk: {_branch_cold_war(counterfactual, 'escalation_risk')}",
            f"- Original deterrence stability: {_branch_cold_war(original, 'deterrence_stability')}",
            f"- Counterfactual deterrence stability: {_branch_cold_war(counterfactual, 'deterrence_stability')}",
            "",
            "## Conclusion",
            str(delta.get("interpretation") or payload.get("summary") or "No interpretation available."),
            "",
            "## Limitations",
            "- This report is rule-generated from deterministic simulation outputs.",
            "- Forks are in-memory only and depend on available snapshots.",
            "- The model uses strategic SR and approximate GR effects rather than full physical simulation.",
        ]
        return "\n".join(lines) + "\n"

    if kind == "sweep":
        summary = payload.get("summary", {})
        runs = payload.get("runs", [])
        lines = [
            "# Parameter Sweep Report",
            "",
            "## Experiment Setup",
            f"- Scenario: `{payload.get('scenario', 'unknown')}`",
            f"- Parameter: `{payload.get('parameter', 'unknown')}`",
            f"- Runs: {len(runs)}",
            "",
            "## Summary",
            f"- Dominant trend: {summary.get('dominant_trend', 'unknown')}",
            f"- Recommendation: {summary.get('recommendation', 'unknown')}",
            f"- Most stable value: {summary.get('best_stability_value', 'unknown')}",
            f"- Highest-risk value: {summary.get('highest_split_risk_value', 'unknown')}",
            "- Cold-war interpretation: compare escalation risk and deterrence stability alongside split risk.",
            "",
            "## Key Runs",
        ]
        for run in runs[:8]:
            lines.append(
                f"- value `{run.get('parameter_value')}`: peak risk {run.get('peak_split_risk')}, "
                f"first split {run.get('year_of_first_split', 'none')}, max polities {run.get('max_polities')}"
            )
        lines.extend(
            [
                "",
                "## Limitations",
                "- This report compares deterministic sweeps and does not estimate statistical confidence.",
                "- Parameter values outside the allowed model ranges are intentionally excluded.",
            ]
        )
        return "\n".join(lines) + "\n"

    if kind == "sensitivity":
        summary = payload.get("summary", {})
        results = payload.get("results", [])
        lines = [
            "# Model Sensitivity Report",
            "",
            "## Experiment Setup",
            f"- Scenario: `{payload.get('scenario', 'unknown')}`",
            f"- Steps: {payload.get('steps', 'unknown')}",
            f"- Seeds: `{payload.get('seeds', [])}`",
            "",
            "## Summary",
            f"- Strongest parameter: `{summary.get('strongest_parameter', 'unknown')}`",
            f"- Dominant effect: {summary.get('dominant_effect', 'unknown')}",
            f"- Recommendation: {summary.get('recommendation', 'unknown')}",
            "",
            "## Parameter Effects",
        ]
        for item in results:
            lines.append(
                f"- `{item.get('parameter')}`: split delta {item.get('split_risk_delta')}, "
                f"escalation delta {item.get('escalation_risk_delta')}, confidence {item.get('confidence')}"
            )
        lines.extend(
            [
                "",
                "## Limitations",
                "- This is a local perturbation scan, not global calibration against external historical data.",
                "- Confidence is based on simulated seed variance and should be read as model-internal robustness.",
                "- Parameters can interact nonlinearly; follow up strong effects with counterfactual and Monte Carlo runs.",
            ]
        )
        return "\n".join(lines) + "\n"

    return "# Experiment Report\n\nUnsupported report kind.\n"


def world_for_ai(world: WorldState) -> dict[str, object]:
    latest = world.metrics[-1].model_dump()
    return {
        "run_id": world.run_id,
        "scenario": world.config.scenario,
        "year": world.year,
        "latest_metrics": latest,
        "recent_events": [event.model_dump(mode="json") for event in world.events[-30:]],
    }


def _branch_metric(branch: dict[str, Any], key: str) -> str:
    final = branch.get("final_metrics", {})
    value = final.get(key)
    if isinstance(value, float):
        return f"{value:.4f}"
    return str(value if value is not None else "unknown")


def _branch_cold_war(branch: dict[str, Any], key: str) -> str:
    final = branch.get("final_metrics", {})
    cold_war = final.get("cold_war", {})
    value = cold_war.get(key)
    if isinstance(value, float):
        return f"{value:.4f}"
    return str(value if value is not None else "unknown")
