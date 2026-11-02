import sqlite3
import tempfile
import unittest
from pathlib import Path
from scripts.consistency.storage import Store


PAIR = {"statement": {"id": "s1", "person_id": "bioguide:A1", "date": "2024-01-01", "sources": [{"url": "https://example.org/s"}]},
        "action": {"id": "a1", "date": "2024-02-01", "sources": [{"url": "https://example.org/a"}]}}
RESULT = {"status": "complete", "classification": "consistent", "probabilities": {"consistent": .9, "inconsistent": .05, "not_relevant": .05},
          "review_status": "resolved", "model": "test", "model_version": "1", "rubric_version": "1",
          "usage": {"total_tokens": 12, "cost": .001, "currency": "USD"}, "metadata": {"attempts": 1}}


class StorageTests(unittest.TestCase):
    def test_idempotency_and_model_version_history(self):
        with Store(":memory:") as store:
            first = store.enqueue("s1:a1", "hash1", PAIR)
            self.assertEqual(first, store.enqueue("s1:a1", "hash1", PAIR))
            store.finish(store.claim(), RESULT)
            self.assertIsNone(store.claim())
            self.assertEqual(store.current("s1:a1", "hash1"), RESULT)
            store.enqueue("s1:a1", "hash2", PAIR)
            newer = {**RESULT, "model_version": "2"}
            store.finish(store.claim(), newer)
            self.assertEqual(store.current("s1:a1"), newer)
            self.assertEqual(len(store.history("s1:a1")), 2)
            with self.assertRaises(sqlite3.IntegrityError):
                store.db.execute("DELETE FROM consistency_results")
            with self.assertRaises(sqlite3.IntegrityError):
                store.db.execute("UPDATE consistency_results SET model='changed'")

    def test_checkpoint_restart_and_concurrent_claim(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "jobs.sqlite"
            with Store(path) as one, Store(path) as two:
                one.enqueue("pair", "fp", PAIR)
                claimed = one.claim()
                self.assertIsNone(two.claim())
                two.db.execute("UPDATE consistency_jobs SET lease_until=0")
                reclaimed = two.claim()
                with self.assertRaises(ValueError):
                    one.finish(claimed, RESULT)
                two.finish(reclaimed, RESULT)
            with Store(path) as restarted:
                self.assertEqual(restarted.current("pair", "fp"), RESULT)
                self.assertEqual(restarted.jobs()[0]["attempt_count"], 2)

    def test_only_active_fingerprints_claimed(self):
        with Store(":memory:") as store:
            store.enqueue("pair", "old", PAIR)
            store.enqueue("pair", "new", PAIR)
            self.assertIsNone(store.claim(fingerprints=[]))
            job = store.claim(fingerprints=["new"])
            self.assertEqual(job["input_fingerprint"], "new")
            store.finish(job, RESULT)
            self.assertIsNone(store.claim(fingerprints=["new"]))

    def test_error_retry_is_explicit_and_usage_is_audited(self):
        with Store(":memory:") as store:
            store.enqueue("pair", "fp", PAIR)
            failure = {**RESULT, "status": "error", "classification": None, "review_status": "needs_review"}
            store.finish(store.claim(), failure)
            store.enqueue("pair", "fp", PAIR)
            self.assertIsNone(store.claim())
            store.enqueue("pair", "fp", PAIR, retry_errors=True)
            store.finish(store.claim(), RESULT)
            self.assertEqual(len(store.history("pair")), 2)
            summary = store.summary()
            self.assertEqual(summary["jobs"], {"complete": 1})
            self.assertEqual(summary["usage"]["total_tokens"], 24)
            self.assertEqual(summary["usage"]["requests"], 2)
            self.assertEqual(summary["usage"]["cost_by_currency"]["USD"], .002)

    def test_rate_limit_deferral_survives_explicit_retry_and_restart(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "jobs.sqlite"
            with Store(path) as store:
                store.enqueue("pair", "fp", PAIR)
                failure = {**RESULT, "status": "error", "error": "rate_limit_deferred",
                           "metadata": {"attempts": 1, "retry_after_seconds": 600}}
                store.finish(store.claim(), failure)
                store.enqueue("pair", "fp", PAIR, retry_errors=True)
                self.assertIsNone(store.claim())
            with Store(path) as reopened:
                self.assertIsNone(reopened.claim())
                reopened.db.execute("UPDATE consistency_jobs SET not_before=0")
                self.assertIsNotNone(reopened.claim())

    def test_version_one_database_migrates_without_dropping_history(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "jobs.sqlite"
            with Store(path) as store:
                store.enqueue("pair", "fp", PAIR)
                store.finish(store.claim(), RESULT)
                store.db.execute("ALTER TABLE consistency_jobs DROP COLUMN not_before")
                store.db.execute("UPDATE consistency_meta SET value='1' WHERE key='schema_version'")
            with Store(path) as migrated:
                self.assertEqual(migrated.summary()["schema_version"], 2)
                self.assertEqual(migrated.current("pair", "fp"), RESULT)
                self.assertIsNone(migrated.jobs()[0]["not_before"])


if __name__ == "__main__":
    unittest.main()
