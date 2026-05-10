CREATE TABLE IF NOT EXISTS public_keys (
  key_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id TEXT NOT NULL,
  key_id TEXT NOT NULL REFERENCES public_keys(key_id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(theme_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_theme ON ratings(theme_id);
CREATE INDEX IF NOT EXISTS idx_ratings_key ON ratings(key_id);

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

CREATE TABLE IF NOT EXISTS install_counts (
  theme_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS install_markers (
  key_id TEXT NOT NULL,
  theme_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (key_id, theme_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
