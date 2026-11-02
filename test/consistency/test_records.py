import copy
import unittest

from scripts.consistency.records import normalize_research, canonical_id, exact_date
from scripts.consistency.retrieval import select_candidates


URL = "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.htm"
SOURCE = {"u": URL, "t": "Official vote"}


def dataset():
    return {"members": [{"id": "alpha", "bioguide": "A000001", "name": "Same Name", "statements": [
        {"topic": "Medicaid protection", "said": {"text": "I oppose reductions to Medicaid eligibility.", "date": "2025-06-01", "src": {"u": "https://example.org/speech", "t": "Speech"}},
         "did": {"text": "Voted NO on the bill reducing Medicaid eligibility.", "date": "2025-07-01", "src": SOURCE}, "assessment": "consistent"}],
        "evidence": {"health": [{"type": "stated", "ref": "alpha:said:0"}, {"type": "senate_vote", "ref": "119-1-372", "date": "2025-07-01", "src": SOURCE, "why": "Reduces eligibility."}]}}],
        "votes": [{"id": "119-1-372", "date": "2025-07-01", "short": "Health Act", "pos": {"alpha": "Nay", "beta": "Yea"}, "question": "Final passage", "codes": [{"issue": "health"}],
                   "bill": {"measure": "H.R. 1 (119th Congress)", "summary": "Reduces Medicaid eligibility.", "summarySrc": SOURCE}}]}


class RecordsTests(unittest.TestCase):
    def test_dedup_vote_evidence_and_did_and_preserve_actual_role(self):
        p = normalize_research(dataset())[0]
        self.assertEqual(p["person_id"], "bioguide:A000001")
        self.assertEqual(len(p["actions"]), 1)
        a = p["actions"][0]
        self.assertEqual(a["position"], "Nay")
        self.assertEqual(a["role"], "Final passage")
        self.assertEqual(a["bill_ids"], ["119-hr-1"])
        self.assertEqual(select_candidates(p["statements"][0], p["actions"])[0]["temporal_relation"], "after")
        self.assertNotIn("assessment", p["statements"][0])

    def test_names_never_match_people(self):
        d = dataset()
        p = copy.deepcopy(d["members"][0]); p.update(id="beta", bioguide="B000001")
        d["members"].append(p)
        first, second = normalize_research(d)
        self.assertEqual(select_candidates(first["statements"][0], second["actions"]), [])
        with self.assertRaises(ValueError):
            canonical_id({"name": "Same Name"})

    def test_statement_ids_survive_reordering_and_changes_are_distinct(self):
        d = dataset(); original = d["members"][0]["statements"][0]
        changed = copy.deepcopy(original); changed["said"].update(text="I support reducing Medicaid eligibility.", date="2025-08-01")
        d["members"][0]["statements"].append(changed)
        p = normalize_research(d)[0]
        ids = {s["text"]: s["id"] for s in p["statements"]}
        self.assertEqual(len(set(ids.values())), 2)
        d["members"][0]["statements"].reverse()
        self.assertEqual(ids, {s["text"]: s["id"] for s in normalize_research(d)[0]["statements"]})
        self.assertEqual(select_candidates(p["statements"][1], p["actions"])[0]["temporal_relation"], "before")

    def test_missing_dates_sources_and_vague_require_review(self):
        p = normalize_research(dataset())[0]
        statement = {**p["statements"][0], "date": None, "sources": [], "vague": True}
        action = {**p["actions"][0], "sources": [], "text": "", "description": ""}
        pair = select_candidates(statement, [action])[0]
        self.assertEqual(set(pair["review_reasons"]), {"unknown_date", "missing_statement_source", "missing_action_source", "vague_statement", "missing_substantive_description"})
        self.assertIsNone(exact_date("2025")); self.assertIsNone(exact_date("2025-02-30"))

    def test_unrelated_actions_not_sent_and_limits_deterministic(self):
        p = normalize_research(dataset())[0]; s = p["statements"][0]
        unrelated = {"id": "unrelated", "person_id": p["person_id"], "text": "Names a post office", "date": "2025-09-01", "sources": []}
        self.assertEqual(select_candidates(s, [unrelated]), [])
        a = p["actions"][0]; b = {**a, "id": "other", "event_key": "other-event", "date": "2025-08-01"}
        self.assertEqual(len(select_candidates(s, [b, a], limit=1)), 1)
        self.assertEqual(select_candidates(s, [b, a], 1), select_candidates(s, [a, b], 1))

    def test_title_only_bill_is_unresolved_not_assumed_substantive(self):
        d = dataset(); d["members"][0]["bills"] = [{"congress": 119, "num": "S. 55", "title": "Medicaid eligibility protection", "date": "2025-07-02", "url": "https://example.org/bill"}]
        p = normalize_research(d)[0]
        a = next(a for a in p["actions"] if a["kind"] == "sponsored")
        self.assertIn("missing_substantive_description", select_candidates(p["statements"][0], [a])[0]["review_reasons"])

    def test_house_modern_url_deduplicates_but_distinct_votes_stay(self):
        d = dataset(); d["votes"] = []; d["members"][0]["evidence"] = {}
        d["members"][0]["statements"][0]["did"]["src"] = {"u": "https://clerk.house.gov/Votes/202611"}
        d["hvotes"] = [{"id": "h-119-2-011", "year": 2026, "roll": 11, "date": "2025-07-01", "short": "Medicaid", "pos": {"alpha": "Yea"}, "bill": {"summary": "Changes Medicaid eligibility."}},
                       {"id": "h-119-2-012", "year": 2026, "roll": 12, "date": "2025-07-01", "short": "Medicaid", "pos": {"alpha": "Nay"}, "bill": {"summary": "Changes Medicaid eligibility."}}]
        self.assertEqual(len(normalize_research(d)[0]["actions"]), 2)

    def test_state_record_refs_bridge_to_content_stable_identity(self):
        d = dataset(); d["votes"] = []
        p = d["members"][0]; source = {"u": "https://example.org/journal"}
        p["record"] = [{"title": "Signed Medicaid expansion", "detail": "Expanded Medicaid eligibility.", "date": "2025-07-01", "position": "Signed", "src": source}]
        p["statements"][0]["did"] = {"text": "Signed expansion of Medicaid eligibility.", "date": "2025-07-01", "src": source}
        p["evidence"] = {"health": [{"type": "official_act", "ref": "alpha:rec:0", "why": "Expanded Medicaid eligibility", "date": "2025-07-01", "src": source}]}
        self.assertEqual(len(normalize_research(d)[0]["actions"]), 1)

    def test_temporal_scope_is_explicit_and_promises_default_forward(self):
        d = dataset(); entry = d["members"][0]["statements"][0]
        self.assertEqual(normalize_research(d)[0]["statements"][0]["temporal_scope"], "position")
        entry["promise"] = True
        self.assertEqual(normalize_research(d)[0]["statements"][0]["temporal_scope"], "forward_commitment")
        entry["temporal_scope"] = "retrospective"
        self.assertEqual(normalize_research(d)[0]["statements"][0]["temporal_scope"], "retrospective")
        entry["temporal_scope"] = "anything"
        with self.assertRaises(ValueError):
            normalize_research(d)

    def test_source_changes_change_identity_for_reclassification(self):
        d = dataset(); a = normalize_research(d)[0]["statements"][0]
        d["members"][0]["statements"][0]["said"]["src"]["u"] = "https://example.org/corrected-speech"
        b = normalize_research(d)[0]["statements"][0]
        self.assertNotEqual(a["id"], b["id"])


if __name__ == "__main__":
    unittest.main()
