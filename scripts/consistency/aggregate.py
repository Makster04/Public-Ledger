"""Deterministic, unweighted aggregation and source-grounded summaries."""
from .retrieval import temporal_relation

AGGREGATION_VERSION = "consistency-unweighted-v1"


def aggregate_statement(statement, results, candidate_count=None, total_action_count=None, min_resolved=1):
    if not isinstance(min_resolved, int) or isinstance(min_resolved, bool) or min_resolved < 1:
        raise ValueError("min_resolved must be a positive integer")
    counts = dict(consistent=0, inconsistent=0, not_relevant=0, review=0, relevant=0, resolved=0, context_only=0)
    scope = statement.get("temporal_scope", "position")
    if scope not in ("position", "forward_commitment", "retrospective"):
        raise ValueError("Unknown statement temporal scope")
    actions = []
    seen = set()
    evaluated = 0
    for raw in results:
        row = dict(raw)
        action = row.get("action") or {}
        event = action.get("event_key") or action.get("id") or row.get("action_id")
        if not event or event in seen:
            continue
        if action.get("person_id") and action["person_id"] != statement.get("person_id"):
            continue
        seen.add(event)
        relation = row.get("temporal_relation") or temporal_relation(statement, action)
        row["temporal_relation"] = relation
        row["same_day_order_unknown"] = relation == "same_day"
        category = row.get("classification")
        complete = row.get("status") == "complete"
        if complete:
            evaluated += 1
        resolved = complete and row.get("review_status") == "resolved" and not row.get("review_reasons") and category in ("consistent", "inconsistent", "not_relevant")
        out_of_scope = (scope == "forward_commitment" and relation == "before") or (scope == "retrospective" and relation == "after")
        if out_of_scope:
            counts["context_only"] += 1
            row["included_in_percentage"] = False
        elif relation == "unknown" or not resolved or statement.get("vague"):
            counts["review"] += 1
            row["included_in_percentage"] = False
        else:
            counts[category] += 1
            counts["resolved"] += 1
            row["included_in_percentage"] = category in ("consistent", "inconsistent")
            if row["included_in_percentage"]:
                counts["relevant"] += 1
        actions.append(row)
    n = counts["relevant"]
    percentage = round(100 * counts["consistent"] / n, 2) if n >= min_resolved else None
    candidates = len(actions) if candidate_count is None else max(len(actions), candidate_count)
    # The review bucket contains potentially relevant evidence; it cannot be
    # silently labeled irrelevant. Coverage is explicitly a resolution fraction,
    # not recall over every political action ever taken.
    potentially_relevant = n + counts["review"]
    coverage = {"candidate_count": candidates, "selected_count": len(actions), "evaluated_count": evaluated,
                "resolved_relevant_count": n, "total_action_count": total_action_count,
                "resolved_relevant_fraction": n / candidates if candidates else None,
                "relevant_resolution_fraction": n / potentially_relevant if potentially_relevant else None,
                "evaluated_fraction": evaluated / candidates if candidates else None,
                "selection_truncated": candidates > len(actions)}
    if percentage is None:
        narrative = f"Insufficient evidence: {n} relevant, resolved action(s); at least {min_resolved} required."
    else:
        narrative = (f"Among {n} relevant, resolved action(s), {counts['consistent']} were classified consistent "
                     f"and {counts['inconsistent']} inconsistent with this statement ({percentage:g}% consistent).")
    narrative += (f" {counts['review']} action(s) require review; {counts['not_relevant']} were classified not relevant. "
                  f"{counts['context_only']} action(s) outside the statement's time scope are shown as context and excluded from the percentage. "
                  "This assessment covers only the recorded actions selected and evaluated, not the politician's complete record.")
    narrative += {"position": " Earlier and later actions may show agreement with a position; this does not establish follow-through or causation.",
                  "forward_commitment": " Earlier actions cannot establish follow-through on this commitment.",
                  "retrospective": " Later actions cannot establish whether a statement about a past record was accurate."}[scope]
    if any(a["same_day_order_unknown"] for a in actions):
        narrative += " The ordering of statements and actions recorded on the same day is unknown."
    return {"statement": statement, "statement_id": statement["id"], "counts": counts, "percentage": percentage,
            "status": "sufficient_evidence" if percentage is not None else "insufficient_evidence",
            "coverage": coverage, "narrative": narrative, "actions": actions,
            "aggregation_version": AGGREGATION_VERSION, "min_resolved": min_resolved}
