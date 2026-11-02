"""Normalize saved research without importing existing verdicts as model evidence.

Canonical politician IDs use bioguide, then FEC candidate ID, then the explicit
local profile ID. Names are display fields only. Statements are immutable source
records; a change of position creates another statement, not a rewritten one.
"""
import hashlib
import json
import re
from datetime import date
from urllib.parse import urlsplit

NORMALIZATION_VERSION = "records-v1"
ACTION_TYPES = {"vote", "senate_vote", "house_vote", "state_vote", "sponsored", "cosponsored", "official_act"}
TEMPORAL_SCOPES = {"position", "forward_commitment", "retrospective"}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def canonical_id(person):
    for key, prefix in (("bioguide", "bioguide"), ("fecCand", "fec"), ("id", "ledger")):
        if person.get(key):
            return f"{prefix}:{person[key]}"
    raise ValueError("Politician has no canonical identifier; name matching is not permitted")


def exact_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def sources(*values):
    result = {}
    for value in values:
        for item in value if isinstance(value, list) else [value]:
            if isinstance(item, str):
                item = {"url": item}
            if not isinstance(item, dict):
                continue
            url = item.get("url") or item.get("u") or ""
            parsed = urlsplit(url)
            if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username:
                continue
            result[url] = {"url": url, "title": item.get("title") or item.get("t") or parsed.hostname}
    return sorted(result.values(), key=lambda x: x["url"])


def bill_id(value, congress=None):
    value = str(value or "")
    if re.fullmatch(r"(?:\d{3}-(?:hr|s|hjres|sjres|hconres|sconres|hres|sres|hamdt|samdt)-\d+|eo-\d+)", value.lower()):
        return value.lower()
    match = re.search(r"\((\d+)(?:st|nd|rd|th) Congress\)", value)
    congress = match.group(1) if match else congress
    measure = re.match(r"\s*((?:H|S)\.?\s*(?:J\.?\s*Res|Con\.?\s*Res|Res|R|Amdt)?)\.?\s*(\d+)", value, re.I)
    if congress and measure:
        return f"{congress}-{re.sub(r'[^a-z]', '', measure.group(1).lower())}-{int(measure.group(2))}"
    return None


def _list(value):
    return value if isinstance(value, list) else ([value] if value else [])


def _topics(value):
    return sorted({str(x).lower() for x in _list(value) if x})


def _event_from_url(url):
    senate = re.search(r"vote_(\d+)_(\d+)_(\d+)\.htm", url)
    if senate:
        return "vote:" + "-".join(str(int(x)) for x in senate.groups())
    house = re.search(r"/evs/(\d{4})/roll(\d+)\.xml", url)
    if not house:
        house = re.search(r"/Votes/(\d{4})(\d+)(?:$|[/?#])", url, re.I)
    if house:
        return f"house:{house[1]}:{int(house[2])}"
    return None


def _role(text):
    match = re.search(r"\b(?:voted\s+)?(YES|NO|Yea|Nay|Guilty|Not guilty)\b", text or "", re.I)
    if match:
        return {"yes": "Yea", "no": "Nay"}.get(match[1].lower(), match[1])
    return "Recorded action"


def normalize_research(data):
    """Return canonical people and source-backed records from the saved dataset.

    Related-topic codes retrieve candidates; existing human verdicts, notes and
    ideological side labels are deliberately not used as classification labels.
    """
    people = []
    vote_by_id = {v["id"]: v for v in data.get("votes", []) + data.get("hvotes", []) if v.get("id")}
    marked_bills = {b["id"]: b for b in data.get("bills", []) + data.get("billIndex", []) if b.get("id")}
    seen_people = set()
    for raw in data.get("members", []) + data.get("cands", []) + data.get("featured", []):
        person_id = canonical_id(raw)
        if person_id in seen_people:
            raise ValueError(f"Duplicate canonical politician: {person_id}")
        seen_people.add(person_id)
        profile = raw.get("id")
        if not profile:
            raise ValueError("A profile ID is required to connect reports to the existing UI")
        evidence = raw.get("evidence") or {}
        result = {"person_id": person_id, "profile_id": profile, "name": raw.get("name", profile),
                  "party": raw.get("party"), "statements": [], "actions": []}
        action_map = {}
        records = raw.get("record") if isinstance(raw.get("record"), list) else []
        record_keys = {i: "official:" + digest([person_id, e.get("date"), e.get("title"), e.get("position"), sources(e.get("src"))])[:24]
                       for i, e in enumerate(records)}

        def did_key(did):
            urls = {s["url"] for s in sources(did.get("src"))}
            official = next((_event_from_url(u) for u in urls if _event_from_url(u)), None)
            if official:
                return official
            # A source can describe many events. Only bridge to an explicit
            # saved record if source AND exact date uniquely identify it.
            matches = [i for i, e in enumerate(records) if exact_date(did.get("date")) and exact_date(e.get("date")) == exact_date(did.get("date"))
                       and urls & {s["url"] for s in sources(e.get("src"))}]
            return record_keys[matches[0]] if len(matches) == 1 else None

        def add_action(item, key=None):
            if not item.get("text") and not item.get("title"):
                return
            item.setdefault("sources", [])
            item.setdefault("topics", [])
            item.setdefault("bill_ids", [])
            item.setdefault("linked_statement_ids", [])
            item.setdefault("review_reasons", [])
            item["person_id"] = person_id
            item["date_raw"] = item.get("date")
            item["date"] = exact_date(item.get("date"))
            # Official roll-call IDs identify events across duplicated evidence
            # annotations and the statement's pre-existing "did" record.
            url_event = next((_event_from_url(s["url"]) for s in item["sources"] if _event_from_url(s["url"])), None)
            event = key or url_event or "record:" + digest([item.get("kind"), item.get("date"), item.get("text"), item["sources"]])[:24]
            item["event_key"] = f"{person_id}:{event}"
            item["id"] = "action:" + digest(item["event_key"])[:24]
            if event in action_map:
                old = action_map[event]
                # The structured vote remains the primary event. Narrative
                # records often mention other events, so keep them as context.
                if item.get("text") and item["text"] != old.get("text"):
                    old.setdefault("additional_context", []).append(item["text"])
                for field in ("topics", "bill_ids", "linked_statement_ids", "review_reasons"):
                    old[field] = sorted(set(old[field] + item[field]))
                old["sources"] = sources(old["sources"], item["sources"])
                return old
            action_map[event] = item
            return item

        # Votes first: explicit member ID lookup and actual cast position, never
        # a chamber's overall outcome assigned to a member.
        for ref, v in vote_by_id.items():
            position = (v.get("pos") or {}).get(profile)
            if position not in ("Yea", "Nay", "Guilty", "Not guilty", "Aye", "No", "Yes"):
                continue
            bill = v.get("bill") or {}
            ev = [e for entries in evidence.values() for e in entries if e.get("ref") == ref]
            citations = sources(*[e.get("src") for e in ev], v.get("src"), v.get("url"), bill.get("summarySrc"))
            description = bill.get("summary") or ""
            if not description:
                description = " ".join(e.get("why", "") for e in ev)
            topics = _topics([c.get("issue") for c in v.get("codes", [])])
            measure = bill_id(v.get("measureKey")) or bill_id(bill.get("measure"), v.get("congress"))
            key = f"house:{v['year']}:{int(v['roll'])}" if v.get("year") and v.get("roll") else "vote:" + ref
            add_action({"kind": "vote", "title": v.get("short", "Recorded vote"), "text": description,
                        "description": description, "position": position, "role": v.get("question") or "Recorded vote",
                        "date": v.get("date"), "sources": citations, "topics": topics,
                        "bill_ids": [measure] if measure else [], "review_reasons": [] if description else ["missing_substantive_description"]}, key)

        statement_keys = set()
        for i, entry in enumerate(raw.get("statements") or []):
            said = entry.get("said") or {}
            scope = entry.get("temporal_scope") or ("forward_commitment" if entry.get("promise") else "position")
            if scope not in TEMPORAL_SCOPES:
                raise ValueError(f"Invalid temporal_scope for {profile}: {scope}")
            text = said.get("text") or entry.get("text") or ""
            citations = sources(said.get("src"), said.get("sources"))
            sid = "statement:" + digest([person_id, entry.get("id") or [text, said.get("date"), [s["url"] for s in citations]]])[:24]
            topics = set(_topics(entry.get("topics") or entry.get("tags")))
            for topic, entries in evidence.items():
                if any(e.get("type") == "stated" and e.get("ref") == f"{profile}:said:{i}" for e in entries):
                    topics.add(topic)
            statement = {"id": sid, "person_id": person_id, "text": text, "date": exact_date(said.get("date")),
                         "date_raw": said.get("date"), "sources": citations, "topics": sorted(topics),
                         "title": entry.get("topic") or "Recorded statement", "bill_ids": [b for b in (bill_id(x) for x in _list(entry.get("bill_ids"))) if b],
                         "kind": "statement", "vague": bool(entry.get("vague")), "source_index": i, "temporal_scope": scope}
            if sid not in statement_keys:
                result["statements"].append(statement)
                statement_keys.add(sid)
            did = entry.get("did") or {}
            if did.get("text"):
                action = add_action({"kind": "documented_action", "title": entry.get("topic", "Recorded action"),
                                    "text": did["text"], "description": did["text"], "date": did.get("date"),
                                    "role": _role(did["text"]), "position": _role(did["text"]), "sources": sources(did.get("src")),
                                    "topics": sorted(topics), "linked_statement_ids": [sid]}, did_key(did))
                if action:
                    statement["bill_ids"] = sorted(set(statement["bill_ids"] + action["bill_ids"]))

        for topic, entries in evidence.items():
            for e in entries:
                if e.get("type") not in ACTION_TYPES or e.get("ref") in vote_by_id:
                    continue
                key = "evidence:" + str(e["ref"]) if e.get("ref") else None
                record_ref = re.fullmatch(re.escape(profile) + r":rec:(\d+)", e.get("ref") or "")
                if record_ref and int(record_ref[1]) in record_keys:
                    key = record_keys[int(record_ref[1])]
                bill_ref = re.fullmatch(re.escape(profile) + r":bill:(\d+)", e.get("ref") or "")
                if bill_ref and int(bill_ref[1]) < len(raw.get("bills") or []):
                    referenced = raw["bills"][int(bill_ref[1])]
                    measure = bill_id(referenced.get("num"), referenced.get("congress"))
                    if measure:
                        key = f"sponsored:{measure}"
                description = e.get("description") or e.get("why") or ""
                bid = bill_id(e.get("bill"))
                add_action({"kind": e["type"], "title": e.get("title", "Recorded action"), "text": description,
                            "description": description, "date": e.get("date"), "sources": sources(e.get("src")),
                            "topics": [topic], "bill_ids": [bid] if bid else [], "role": e["type"], "position": e.get("pos"),
                            "review_reasons": [] if description else ["missing_substantive_description"]}, key)

        for record_index, entry in enumerate(records):
            description = entry.get("detail") or entry.get("description") or ""
            bid = bill_id(entry.get("bill"))
            add_action({"kind": "official_act", "title": entry.get("title", "Official act"), "text": description,
                        "description": description, "date": entry.get("date"), "sources": sources(entry.get("src"), entry.get("more")),
                        "topics": _topics(entry.get("area")), "bill_ids": [bid] if bid else [],
                        "position": entry.get("position"), "role": entry.get("position") or "Official act",
                        "review_reasons": [] if description else ["missing_substantive_description"]}, record_keys[record_index])

        sponsorships = [(b, "sponsored") for b in raw.get("bills") or []]
        sponsorships += [(b, "cosponsored") for b in raw.get("cosponsored") or []]
        for b in marked_bills.values():
            for sponsor in b.get("cosponsors") or []:
                if sponsor.get("person") == profile:
                    sponsorships.append(({**b, **sponsor, "bill": sponsor.get("bill") or b["id"]}, "sponsored" if sponsor.get("sponsor") else "cosponsored"))
        for entry, kind in sponsorships:
            bid = bill_id(entry.get("bill")) or bill_id(entry.get("id")) or bill_id(entry.get("num"), entry.get("congress"))
            description = entry.get("description") or entry.get("summary") or ""
            if isinstance(description, dict):
                description = description.get("text", "")
            # Do not attach a later law's economic analysis to an earlier bill
            # version merely because its bill number matches.
            add_action({"kind": kind, "title": entry.get("title", "Bill sponsorship"), "text": description,
                        "description": description, "date": entry.get("date"), "sources": sources(entry.get("src"), entry.get("url")),
                        "topics": _topics(entry.get("area")), "bill_ids": [bid] if bid else [], "role": kind, "position": "Support",
                        "review_reasons": [] if description else ["missing_substantive_description"]},
                       f"{kind}:{bid}" if bid else None)
        result["actions"] = sorted(action_map.values(), key=lambda a: (a.get("date") or "", a["id"]))
        people.append(result)
    return people
