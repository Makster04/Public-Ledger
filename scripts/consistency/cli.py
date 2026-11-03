"""Offline/background statement-action pipeline; never invoked by a page request."""
import argparse
import json
import os
from pathlib import Path
import tempfile
import time
from datetime import datetime, timezone

from .records import normalize_research, sources, exact_date
from .retrieval import select_candidates
from .aggregate import aggregate_statement
from .provider import OpenAIResponsesClient, ConfigurationError, load_config, config_identity, fingerprint, RUBRIC_VERSION
from .storage import Store

ROOT = Path(__file__).resolve().parents[2]
METHOD_VERSION = "consistency-unweighted-v1"


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".consistency-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def read_people(research, supplemental=None):
    people = normalize_research(json.loads(Path(research).read_text()))
    if supplemental:
        extra = json.loads(Path(supplemental).read_text())
        by_id = {p["person_id"]: p for p in people}
        for person in extra["people"]:
            if person["person_id"] not in by_id:
                raise ValueError("Supplemental records require a known canonical person ID")
            target = by_id[person["person_id"]]
            for kind in ("statements", "actions"):
                known = {r["id"] for r in target[kind]}
                for record in person.get(kind, []):
                    if not isinstance(record, dict) or not isinstance(record.get("id"), str) or not record["id"].strip():
                        raise ValueError("Supplemental records require an explicit nonempty ID")
                    if record.get("person_id") != person["person_id"]:
                        raise ValueError("Supplemental record identity mismatch")
                    if not isinstance(record.get("text"), str) or not record["text"].strip():
                        raise ValueError("Supplemental records require substantive text")
                    if record["id"] in known:
                        raise ValueError("Duplicate supplemental record ID; update its original source")
                    record = dict(record)
                    record["sources"] = sources(record.get("sources", []))
                    record["date_raw"] = record.get("date")
                    record["date"] = exact_date(record.get("date"))
                    for field in ("topics", "bill_ids", "review_reasons"):
                        value = record.get(field, [])
                        if not isinstance(value, list) or any(not isinstance(v, str) for v in value):
                            raise ValueError("Supplemental metadata must contain lists of strings")
                        record[field] = value
                    if kind == "statements":
                        scope = record.get("temporal_scope", "position")
                        if scope not in ("position", "forward_commitment", "retrospective"):
                            raise ValueError("Invalid supplemental statement time scope")
                        record["temporal_scope"] = scope
                    if kind == "actions":
                        record["event_key"] = record.get("event_key") or record["id"]
                        if not record.get("kind") or not record.get("role"):
                            record["review_reasons"] = record["review_reasons"] + ["missing_action_role"]
                    target[kind].append(record)
                    known.add(record["id"])
    return people


def plan(people, identity, policy):
    planned = []
    for person in people:
        for statement in person["statements"]:
            candidates = select_candidates(statement, person["actions"], limit=100000)
            selected = candidates[:policy["candidate_limit"]]
            pairs = []
            for pair in selected:
                key = person["person_id"] + "|" + statement["id"] + "|" + pair["action"]["id"]
                digest = fingerprint(pair, identity, policy)
                pairs.append((key, digest, pair))
            planned.append((person, statement, pairs, len(candidates)))
    return planned


def unresolved(pair, reason="Awaiting classification"):
    return {**pair, "classification": None, "probabilities": None, "confidence": None,
            "review_status": "needs_review", "status": "pending",
            "review_reasons": list(dict.fromkeys(pair.get("review_reasons", []) + [reason]))}


def publish(store, planned, args, identity, policy):
    people = {}
    for person, statement, pairs, pool_size in planned:
        rows = []
        for key, digest, pair in pairs:
            result = store.current(key, digest)
            rows.append({**pair, **result} if result else unresolved(pair))
        report = aggregate_statement(statement, rows, candidate_count=len(pairs),
                                     total_action_count=len(person["actions"]), min_resolved=args.min_resolved)
        report["coverage"].update({"candidate_pool_count": pool_size,
                                   "retrieval_truncated": pool_size > len(pairs)})
        target = people.setdefault(person["profile_id"], {
            "person_id": person["person_id"], "profile_id": person["profile_id"],
            "name": person["name"], "statements": []})
        target["statements"].append(report)
    document = {"schema_version": 1, "generated_at": datetime.now(timezone.utc).isoformat(),
                "methodology": {"version": METHOD_VERSION, "rubric_version": RUBRIC_VERSION, **policy,
                  "scope": "Selected recorded actions within the statement time scope; agreement does not establish causation.",
                  "coverage_definition": "Resolved relevant actions divided by selected candidate actions; not all career activity."},
                "provider": {"configured": identity.get("model") != "unconfigured", **identity},
                "people": people}
    atomic_json(args.output, document)
    return document


def cycle(args):
    config = load_config(args.openai_config)
    identity = config_identity(config)
    policy = {"version": METHOD_VERSION, "min_resolved": args.min_resolved,
              "candidate_limit": args.candidates, "min_confidence": args.confidence,
              "min_margin": args.margin, "temporal_policy": "per-statement-scope-v1"}
    people = read_people(args.research, args.records)
    planned = plan(people, identity, policy)
    with Store(args.database) as store:
        if args.command == "status":
            print(json.dumps(store.summary(), sort_keys=True))
            return 0
        fingerprints = []
        for _, _, pairs, _ in planned:
            for key, digest, pair in pairs:
                fingerprints.append(digest)
                store.enqueue(key, digest, pair, retry_errors=args.retry_errors)
        if args.command == "run":
            if not os.environ.get("OPENAI_API_KEY"):
                publish(store, planned, args, identity, policy)
                raise ConfigurationError("Set OPENAI_API_KEY in the server environment; no requests were made")
            client = OpenAIResponsesClient(config, min_confidence=args.confidence, min_margin=args.margin)
            for _ in range(args.limit):
                job = store.claim(fingerprints=fingerprints)
                if not job:
                    break
                pair = job["payload"]
                if pair.get("review_reasons"):
                    result = {**unresolved(pair, "Evidence needs review before classification"), "status": "blocked"}
                else:
                    result = client.classify(pair)
                result.update({"rubric_version": RUBRIC_VERSION, "aggregation_version": METHOD_VERSION,
                               "input_fingerprint": job["input_fingerprint"],
                               "classified_at": datetime.now(timezone.utc).isoformat()})
                store.finish(job, result)
                publish(store, planned, args, identity, policy)
            # Export even with an empty queue: incremental reruns remain idempotent.
        document = publish(store, planned, args, identity, policy)
        print(json.dumps({"profiles": len(document["people"]), "statements": len(planned),
                          "selected_pairs": len(fingerprints), "provider_configured": True,
                          "credentials_configured": bool(os.environ.get("OPENAI_API_KEY")),
                          "output": str(args.output), "queue": store.summary()}, sort_keys=True))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "run", "export", "status"])
    parser.add_argument("--research", default=str(ROOT / "public/research.json"))
    parser.add_argument("--retry-errors", action="store_true", help="Explicitly retry failed requests while retaining attempt history")
    parser.add_argument("--records", help="Additional normalized sourced records matched by canonical ID")
    parser.add_argument("--database", default=str(ROOT / ".local/consistency.sqlite"))
    parser.add_argument("--output", default=str(ROOT / "public/consistency.json"))
    parser.add_argument("--openai-config", default=os.environ.get("OPENAI_PROVIDER_CONFIG", str(ROOT / "data/consistency/openai-responses.json")))
    parser.add_argument("--limit", type=int, default=20, help="Maximum pairs per run; each may retry up to three requests")
    parser.add_argument("--candidates", type=int, default=20)
    parser.add_argument("--min-resolved", type=int, default=1)
    parser.add_argument("--confidence", type=float, default=.8)
    parser.add_argument("--margin", type=float, default=.2)
    parser.add_argument("--watch", type=int, default=0, help="Background polling interval in seconds, at least 60")
    args = parser.parse_args(argv)
    if not 1 <= args.limit <= 1000 or not 1 <= args.candidates <= 1000 or args.min_resolved < 1:
        parser.error("Limits must be positive; request/candidate limits cannot exceed 1000")
    if not 0 <= args.confidence <= 1 or not 0 <= args.margin <= 1:
        parser.error("Confidence and margin must be between 0 and 1")
    if args.watch and (args.watch < 60 or args.command != "run"):
        parser.error("--watch requires run and an interval of at least 60 seconds")
    try:
        while True:
            cycle(args)
            if not args.watch:
                return 0
            time.sleep(args.watch)
    except (ConfigurationError, ValueError, OSError) as error:
        print(json.dumps({"error": str(error), "status": "configuration_or_input_error"}))
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
