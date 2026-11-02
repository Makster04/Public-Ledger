PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS consistency_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO consistency_meta VALUES ('schema_version','2');
CREATE TABLE IF NOT EXISTS consistency_jobs (
  id TEXT PRIMARY KEY, pair_key TEXT NOT NULL, input_fingerprint TEXT NOT NULL,
  payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  created_at REAL NOT NULL, updated_at REAL NOT NULL,
  lease_until REAL, lease_token TEXT, attempt_count INTEGER NOT NULL DEFAULT 0,
  not_before REAL,
  UNIQUE(pair_key,input_fingerprint)
);
CREATE INDEX IF NOT EXISTS consistency_pending ON consistency_jobs(status,created_at);
CREATE TABLE IF NOT EXISTS consistency_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES consistency_jobs(id),
  pair_key TEXT NOT NULL, input_fingerprint TEXT NOT NULL, person_id TEXT,
  statement_id TEXT, action_id TEXT, statement_date TEXT, action_date TEXT,
  classification TEXT, review_status TEXT, status TEXT NOT NULL,
  model TEXT, model_version TEXT, rubric_version TEXT,
  result TEXT NOT NULL, created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS consistency_history ON consistency_results(pair_key,id);
CREATE TRIGGER IF NOT EXISTS consistency_results_no_update BEFORE UPDATE ON consistency_results
BEGIN SELECT RAISE(ABORT,'Classification history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS consistency_results_no_delete BEFORE DELETE ON consistency_results
BEGIN SELECT RAISE(ABORT,'Classification history is immutable'); END;
