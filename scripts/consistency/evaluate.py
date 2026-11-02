"""Compare saved classifier outputs with explicit, provenance-bearing references.

No network calls and no fabricated model accuracy. Synthetic specification checks
and unadjudicated legacy labels are not a validated human benchmark.
"""
import argparse
import json
import math
from pathlib import Path

LABELS = ("consistent", "inconsistent", "not_relevant")


def evaluate_cases(cases, results_by_id):
    """Return raw classification agreement separately from review/coverage metrics."""
    ids = [c["id"] for c in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("Evaluation case IDs must be unique")
    matrix = {a: {b: 0 for b in LABELS} for a in LABELS}
    groups, errors, disagreements, review_disagreements = {}, [], [], []
    missing, scored, correct, resolved, resolved_correct, review_checks = 0, 0, 0, 0, 0, 0
    high_confidence, high_correct, confidence_count, confidence_sum = 0, 0, 0, 0.0
    for case in cases:
        expected = case.get("expected_label")
        if expected is not None and expected not in LABELS:
            raise ValueError("Unknown reference label for " + case["id"])
        group = groups.setdefault(case.get("party", "unknown"), {"cases": 0, "scored": 0, "correct": 0})
        group["cases"] += 1
        result = results_by_id.get(case["id"])
        if not result:
            missing += 1
            continue
        if result.get("status") == "error":
            errors.append({"id": case["id"], "reason": "classification_error"})
            continue
        if result.get("status") != "complete":
            missing += 1
            continue
        prediction = result.get("classification")
        if prediction not in LABELS:
            errors.append({"id": case["id"], "reason": "invalid_classification"})
            continue
        is_review = result.get("review_status") != "resolved"
        if "expected_review" in case:
            review_checks += 1
            if bool(case["expected_review"]) != is_review:
                review_disagreements.append({"id": case["id"], "expected_review": case["expected_review"], "actual_review": is_review})
        if expected is None:
            continue
        matched = expected == prediction
        scored += 1
        correct += matched
        group["scored"] += 1
        group["correct"] += matched
        matrix[expected][prediction] += 1
        if not is_review:
            resolved += 1
            resolved_correct += matched
        if not matched:
            disagreements.append({"id": case["id"], "party": case.get("party"), "expected": expected, "predicted": prediction, "review_status": result.get("review_status"), "label_provenance": case.get("label_provenance")})
        confidence = result.get("confidence", result.get("probabilities", {}).get(prediction))
        if isinstance(confidence, (int, float)) and not isinstance(confidence, bool) and math.isfinite(confidence) and 0 <= confidence <= 1:
            confidence_count += 1
            confidence_sum += confidence
            if confidence >= .8:
                high_confidence += 1
                high_correct += matched
    for group in groups.values():
        group["reference_agreement"] = group["correct"] / group["scored"] if group["scored"] else None
    return {
        "evaluation_version": "reference-agreement-v1",
        "status": "evaluated" if scored else "no_scored_predictions",
        "notice": "Agreement with provisional references is not verified accuracy. Human adjudication and a representative holdout are still required; model confidence is not accuracy.",
        "cases": len(cases), "labeled_cases": sum(c.get("expected_label") in LABELS for c in cases),
        "human_adjudicated_cases": sum(c.get("label_provenance", {}).get("human_adjudicated") is True for c in cases),
        "missing_or_pending": missing, "errors": errors,
        "scored": scored, "correct": correct,
        "reference_agreement": correct / scored if scored else None,
        "resolved_predictions": resolved,
        "resolved_reference_agreement": resolved_correct / resolved if resolved else None,
        "mean_reported_confidence": confidence_sum / confidence_count if confidence_count else None,
        "high_confidence_predictions": high_confidence,
        "high_confidence_reference_agreement": high_correct / high_confidence if high_confidence else None,
        "confusion_matrix": matrix, "by_party": groups,
        "disagreements": disagreements, "review_checks": review_checks,
        "review_disagreements": review_disagreements,
        "unknown_result_ids": sorted(set(results_by_id) - set(ids)),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=Path(__file__).resolve().parents[2] / "test/fixtures/consistency-evaluation.json")
    parser.add_argument("--results", type=Path, help="Saved JSON mapping case ID to classification result, optionally wrapped in results")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    dataset = json.loads(args.dataset.read_text())
    cases = dataset.get("cases", []) if isinstance(dataset, dict) else dataset
    results = json.loads(args.results.read_text()) if args.results else {}
    if isinstance(results, dict) and "results" in results:
        results = results["results"]
    if not isinstance(results, dict):
        parser.error("--results must contain an object keyed by evaluation case ID")
    report = evaluate_cases(cases, results)
    serialized = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized)
    else:
        print(serialized, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
