CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id TEXT NOT NULL,
  odid TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(theme_id, odid)
);

CREATE INDEX IF NOT EXISTS idx_ratings_theme ON ratings(theme_id);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id TEXT UNIQUE,
  repo TEXT,
  commit_sha TEXT,
  event TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_repo ON webhook_logs(repo);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at);
