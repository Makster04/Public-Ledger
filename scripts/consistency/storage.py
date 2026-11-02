"""Durable jobs and append-only classification history, separate from source refreshes."""
import json
import math
import sqlite3
import time
import uuid
from pathlib import Path


class Store:
    def __init__(self, path):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), timeout=30, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(Path(__file__).with_name("schema.sql").read_text())
        version = self.db.execute("SELECT value FROM consistency_meta WHERE key='schema_version'").fetchone()[0]
        if version == "1":
            # Additive migration preserves old inputs and immutable results.
            if "not_before" not in {row[1] for row in self.db.execute("PRAGMA table_info(consistency_jobs)")}:
                self.db.execute("ALTER TABLE consistency_jobs ADD COLUMN not_before REAL")
            self.db.execute("UPDATE consistency_meta SET value='2' WHERE key='schema_version'")
        elif version != "2":
            raise ValueError("Unsupported consistency database schema")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def close(self):
        self.db.close()

    def enqueue(self, pair_key, fingerprint, payload, retry_errors=False):
        now = time.time()
        self.db.execute("INSERT OR IGNORE INTO consistency_jobs(id,pair_key,input_fingerprint,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                        (uuid.uuid4().hex, pair_key, fingerprint, json.dumps(payload, ensure_ascii=False, allow_nan=False), now, now))
        if retry_errors:
            self.db.execute("UPDATE consistency_jobs SET status='pending',updated_at=? WHERE pair_key=? AND input_fingerprint=? AND status='error'", (now, pair_key, fingerprint))
        return self.db.execute("SELECT id FROM consistency_jobs WHERE pair_key=? AND input_fingerprint=?", (pair_key, fingerprint)).fetchone()[0]

    def _job(self, row):
        if row is None:
            return None
        result = dict(row)
        result["payload"] = json.loads(result["payload"])
        return result

    def jobs(self):
        return [self._job(row) for row in self.db.execute("SELECT * FROM consistency_jobs ORDER BY created_at,id")]

    def claim(self, lease_seconds=300, fingerprints=None):
        now, token = time.time(), uuid.uuid4().hex
        self.db.execute("BEGIN IMMEDIATE")
        try:
            eligible = self.db.execute("SELECT * FROM consistency_jobs WHERE (status='pending' OR (status='running' AND lease_until<?)) AND (not_before IS NULL OR not_before<=?) ORDER BY created_at,id", (now, now))
            allowed = None if fingerprints is None else set(fingerprints)
            row = next((item for item in eligible if allowed is None or item["input_fingerprint"] in allowed), None)
            if row is None:
                self.db.execute("COMMIT")
                return None
            self.db.execute("UPDATE consistency_jobs SET status='running',lease_until=?,lease_token=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?", (now + max(1, lease_seconds), token, now, row["id"]))
            claimed = self.db.execute("SELECT * FROM consistency_jobs WHERE id=?", (row["id"],)).fetchone()
            self.db.execute("COMMIT")
            return self._job(claimed)
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def finish(self, job, result):
        if result.get("status") not in ("complete", "error", "blocked"):
            raise ValueError("A finished classification must be complete, error or blocked")
        now = time.time()
        self.db.execute("BEGIN IMMEDIATE")
        try:
            current = self.db.execute("SELECT * FROM consistency_jobs WHERE id=?", (job["id"],)).fetchone()
            if current is None or current["status"] != "running" or current["lease_token"] != job.get("lease_token"):
                raise ValueError("Classification job lease was lost")
            payload = json.loads(current["payload"])
            statement, action = payload.get("statement", {}), payload.get("action", {})
            # Persist exact input references in jobs and exact result metadata in immutable history.
            self.db.execute("""INSERT INTO consistency_results(job_id,pair_key,input_fingerprint,person_id,statement_id,action_id,
                statement_date,action_date,classification,review_status,status,model,model_version,rubric_version,result,created_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
                    current["id"], current["pair_key"], current["input_fingerprint"], statement.get("person_id"),
                    statement.get("id"), action.get("id"), statement.get("date"), action.get("date"),
                    result.get("classification"), result.get("review_status"), result["status"], result.get("model"),
                    result.get("model_version"), result.get("rubric_version"), json.dumps(result, ensure_ascii=False, allow_nan=False), now))
            delay = (result.get("metadata") or {}).get("retry_after_seconds")
            not_before = now + delay if isinstance(delay, (int, float)) and math.isfinite(delay) and delay > 0 else None
            self.db.execute("UPDATE consistency_jobs SET status=?,updated_at=?,lease_until=NULL,lease_token=NULL,not_before=? WHERE id=?", (result["status"], now, not_before, job["id"]))
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def current(self, pair_key, fingerprint=None):
        sql, args = "SELECT result FROM consistency_results WHERE pair_key=?", [pair_key]
        if fingerprint is not None:
            sql += " AND input_fingerprint=?"
            args.append(fingerprint)
        row = self.db.execute(sql + " ORDER BY id DESC LIMIT 1", args).fetchone()
        return json.loads(row[0]) if row else None

    def history(self, pair_key):
        return [{**dict(row), "result": json.loads(row["result"])} for row in self.db.execute("SELECT * FROM consistency_results WHERE pair_key=? ORDER BY id", (pair_key,))]

    def summary(self):
        counts = {row[0]: row[1] for row in self.db.execute("SELECT status,count(*) FROM consistency_jobs GROUP BY status")}
        totals = {"input_tokens": None, "output_tokens": None, "total_tokens": None, "cost_by_currency": {}, "requests": 0, "unreported_usage_results": 0}
        for row in self.db.execute("SELECT result FROM consistency_results"):
            result = json.loads(row[0])
            usage = result.get("usage") or {}
            totals["requests"] += (result.get("metadata") or {}).get("attempts", 0)
            for key in ("input_tokens", "output_tokens", "total_tokens"):
                if usage.get(key) is not None:
                    totals[key] = (totals[key] or 0) + usage[key]
            if usage.get("cost") is not None:
                currency = usage.get("currency") or "unspecified"
                totals["cost_by_currency"][currency] = totals["cost_by_currency"].get(currency, 0) + usage["cost"]
            if not usage or all(usage.get(k) is None for k in ("input_tokens", "output_tokens", "total_tokens", "cost")):
                totals["unreported_usage_results"] += 1
        return {"jobs": counts, "usage": totals, "schema_version": 2}
