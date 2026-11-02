import unittest
from scripts.consistency.aggregate import aggregate_statement


S = {"id": "statement:1", "person_id": "ledger:person", "date": "2025-01-01", "text": "I support expanding health coverage."}


def result(i, category="consistent", **kwargs):
    return {"action": {"id": f"action:{i}", "person_id": S["person_id"], "date": "2025-02-01"},
            "classification": category, "status": "complete", "review_status": "resolved", **kwargs}


class AggregateTests(unittest.TestCase):
    def test_exact_denominator_and_conflicting_evidence(self):
        rows = [result(1), result(2), result(3, "inconsistent"), result(4, "not_relevant"), result(5, status="pending"), result(6, status="error")]
        report = aggregate_statement(S, rows, candidate_count=10, total_action_count=100)
        self.assertEqual(report["percentage"], 66.67)
        self.assertEqual(report["counts"], {"consistent": 2, "inconsistent": 1, "not_relevant": 1, "review": 2, "relevant": 3, "resolved": 4, "context_only": 0})
        self.assertEqual(report["coverage"]["resolved_relevant_fraction"], .3)
        self.assertEqual(report["coverage"]["relevant_resolution_fraction"], .6)
        self.assertTrue(report["coverage"]["selection_truncated"])
        self.assertIn("2 were classified consistent and 1 inconsistent", report["narrative"])

    def test_no_evidence_not_zero_or_hundred(self):
        for rows in ([], [result(1, "not_relevant")], [result(1, review_status="needs_review")]):
            report = aggregate_statement(S, rows)
            self.assertIsNone(report["percentage"])
            self.assertIn("Insufficient evidence", report["narrative"])

    def test_before_forward_commitment_is_context_and_unknown_date_review(self):
        rows = [result(1, temporal_relation="before"), result(2, temporal_relation="unknown"), result(3, temporal_relation="same_day")]
        report = aggregate_statement({**S, "temporal_scope": "forward_commitment"}, rows)
        self.assertEqual(report["counts"]["context_only"], 1)
        self.assertEqual(report["counts"]["review"], 1)
        self.assertEqual(report["counts"]["relevant"], 1)
        self.assertEqual(report["percentage"], 100)

    def test_position_includes_before_and_after_as_agreement(self):
        rows = [result(1, temporal_relation="before"), result(2, "inconsistent", temporal_relation="after")]
        report = aggregate_statement(S, rows)
        self.assertEqual(report["percentage"], 50)
        self.assertEqual(report["counts"]["context_only"], 0)
        self.assertIn("does not establish follow-through", report["narrative"])

    def test_retrospective_excludes_later_and_labels_same_day_order(self):
        rows = [result(1, temporal_relation="before"), result(2, "inconsistent", temporal_relation="after"), result(3, temporal_relation="same_day")]
        report = aggregate_statement({**S, "temporal_scope": "retrospective"}, rows)
        self.assertEqual(report["percentage"], 100)
        self.assertEqual(report["counts"]["context_only"], 1)
        self.assertIn("ordering", report["narrative"])
        self.assertTrue(report["actions"][2]["same_day_order_unknown"])

    def test_vague_or_low_confidence_are_not_resolved(self):
        self.assertIsNone(aggregate_statement({**S, "vague": True}, [result(1)])["percentage"])
        self.assertIsNone(aggregate_statement(S, [result(1, review_status="needs_review", probabilities={"consistent": .4, "inconsistent": .4, "not_relevant": .2})])["percentage"])
        self.assertIsNone(aggregate_statement(S, [result(1, review_reasons=["missing_action_source"])])["percentage"])

    def test_dedup_and_canonical_person_boundary(self):
        a = result(1); duplicate = result(2); a["action"]["event_key"] = duplicate["action"]["event_key"] = "same"
        other = result(3); other["action"]["person_id"] = "ledger:other"
        report = aggregate_statement(S, [a, duplicate, other])
        self.assertEqual(report["counts"]["consistent"], 1)

    def test_configurable_minimum(self):
        self.assertIsNone(aggregate_statement(S, [result(1)], min_resolved=2)["percentage"])
        with self.assertRaises(ValueError):
            aggregate_statement(S, [], min_resolved=0)


if __name__ == "__main__":
    unittest.main()
