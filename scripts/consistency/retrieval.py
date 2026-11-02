"""Bounded candidate retrieval. A retrieval match is never a classification."""
import re
from .records import exact_date

RETRIEVAL_VERSION = "candidate-v1"
STOP = set("the and for with from that this have has will would should their they our your into about which when were was are not but bill act voted vote support oppose said congress senator representative statement action record recorded".split())


def tokens(record):
    text = " ".join(str(record.get(k) or "") for k in ("text", "title", "description"))
    return {t for t in re.findall(r"[a-z]{3,}", text.lower()) if t not in STOP}


def temporal_relation(statement, action):
    s, a = exact_date(statement.get("date")), exact_date(action.get("date"))
    if not s or not a:
        return "unknown"
    return "before" if a < s else "after" if a > s else "same_day"


def select_candidates(statement, actions, limit=20):
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 0:
        raise ValueError("Candidate limit must be a non-negative integer")
    ranked = []
    st = tokens(statement)
    seen = set()
    for action in actions:
        if action.get("person_id") != statement.get("person_id") or not action.get("person_id"):
            continue
        event = action.get("event_key") or action.get("id")
        if not event or event in seen:
            continue
        seen.add(event)
        reasons = []
        score = 0
        if statement["id"] in action.get("linked_statement_ids", []):
            reasons.append("existing_statement_action_link")
            score += 100
        bills = set(statement.get("bill_ids", [])) & set(action.get("bill_ids", []))
        if bills:
            reasons.append("shared_bill:" + ",".join(sorted(bills)))
            score += 30
        topics = set(statement.get("topics", [])) & set(action.get("topics", []))
        if topics:
            reasons.append("shared_topic:" + ",".join(sorted(topics)))
            score += 10 * len(topics)
        words = st & tokens(action)
        if len(words) >= 2:
            reasons.append("shared_keywords:" + ",".join(sorted(words)[:12]))
            score += min(len(words), 10)
        if not reasons:
            continue
        temporal = temporal_relation(statement, action)
        review = set(action.get("review_reasons", []))
        if statement.get("vague") or len(st) < 2:
            review.add("vague_statement")
        if not statement.get("sources"):
            review.add("missing_statement_source")
        if not action.get("sources"):
            review.add("missing_action_source")
        if not (action.get("description") or action.get("text")):
            review.add("missing_substantive_description")
        if temporal == "unknown":
            review.add("unknown_date")
        ranked.append((score, action.get("date") or "", action["id"], {
            "statement": statement, "action": action, "temporal_relation": temporal,
            "same_day_order_unknown": temporal == "same_day",
            "selection_reasons": reasons, "review_reasons": sorted(review)}))
    ranked.sort(key=lambda r: (-r[0], r[1], r[2]))
    return [r[3] for r in ranked[:limit]]
