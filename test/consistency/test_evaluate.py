import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from consistency.evaluate import evaluate_cases


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.cases = [
            {"id": "a", "party": "D", "expected_label": "consistent", "expected_review": False},
            {"id": "b", "party": "R", "expected_label": "inconsistent", "expected_review": False},
            {"id": "c", "party": "I", "expected_label": "not_relevant", "expected_review": False},
            {"id": "d", "party": "I", "expected_label": None, "expected_review": True},
        ]

    def result(self, label, confidence=.9, review="resolved"):
        return {"classification": label, "confidence": confidence, "status": "complete", "review_status": review}

    def test_no_model_outputs_does_not_claim_accuracy(self):
        report = evaluate_cases(self.cases, {})
        self.assertEqual(report["status"], "no_scored_predictions")
        self.assertEqual(report["missing_or_pending"], 4)
        self.assertIsNone(report["reference_agreement"])
        self.assertIsNone(report["mean_reported_confidence"])

    def test_confident_disagreement_is_reported(self):
        report = evaluate_cases(self.cases, {"a": self.result("consistent"), "b": self.result("consistent", .99), "c": self.result("not_relevant")})
        self.assertAlmostEqual(report["reference_agreement"], 2 / 3)
        self.assertEqual(report["disagreements"][0]["id"], "b")
        self.assertEqual(report["confusion_matrix"]["inconsistent"]["consistent"], 1)
        self.assertEqual(report["by_party"]["R"]["reference_agreement"], 0)
        self.assertAlmostEqual(report["high_confidence_reference_agreement"], 2 / 3)

    def test_review_outcomes_and_missing_labels_are_separate(self):
        report = evaluate_cases(self.cases, {"a": self.result("consistent", .55, "needs_review"), "d": self.result("not_relevant", .5, "needs_review")})
        self.assertEqual(report["scored"], 1)
        self.assertEqual(report["resolved_predictions"], 0)
        self.assertEqual(report["review_checks"], 2)
        self.assertEqual(report["review_disagreements"][0]["id"], "a")

    def test_failures_invalid_labels_and_extra_ids(self):
        report = evaluate_cases(self.cases, {"a": {"status": "error", "error": "secret raw error"}, "b": self.result("made_up"), "c": {"status": "pending"}, "other": self.result("consistent")})
        self.assertEqual(len(report["errors"]), 2)
        self.assertEqual(report["unknown_result_ids"], ["other"])
        self.assertNotIn("secret", json.dumps(report))

    def test_duplicate_case_ids_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_cases([self.cases[0], self.cases[0]], {})

    def test_reference_dataset_is_diverse_and_honest(self):
        data = json.loads((ROOT / "test/fixtures/consistency-evaluation.json").read_text())
        self.assertEqual({c["party"] for c in data["cases"]}, {"D", "R", "I"})
        self.assertTrue(all(not c["label_provenance"]["human_adjudicated"] for c in data["cases"]))
        self.assertTrue(any(c.get("synthetic") for c in data["cases"]))
        self.assertTrue(any(c["label_provenance"]["type"] == "legacy_research_assessment" for c in data["cases"]))

    def test_cli_without_results_reports_unavailable(self):
        proc = subprocess.run([sys.executable, str(ROOT / "scripts/consistency/evaluate.py")], capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(proc.stdout)["status"], "no_scored_predictions")


if __name__ == "__main__":
    unittest.main()
