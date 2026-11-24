CREATE TABLE IF NOT EXISTS app_sync (
  owner_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('parking', 'food', 'people', 'cooking', 'mahjong')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  write_token TEXT NOT NULL,
  PRIMARY KEY (owner_id, scope)
);

CREATE TABLE IF NOT EXISTS app_sync_parts (
  owner_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  contents TEXT NOT NULL,
  PRIMARY KEY (owner_id, scope, position),
  FOREIGN KEY (owner_id, scope) REFERENCES app_sync (owner_id, scope) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  scope TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_attempts_by_reset ON auth_attempts(reset_at);
