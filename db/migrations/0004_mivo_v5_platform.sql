-- MIVO V5 platform foundation: smarter matching, privacy, safety, appeals,
-- feature flags, operational controls, announcements, metrics, and session risk.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS safety_score integer NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS safety_band text NOT NULL DEFAULT 'normal';
ALTER TABLE users ADD COLUMN IF NOT EXISTS shadow_restricted_until text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_risk_at text;

ALTER TABLE preferences ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT 'id';
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS region_match_mode text NOT NULL DEFAULT 'anywhere';
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS incognito_mode integer NOT NULL DEFAULT 0;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS default_retention_days integer NOT NULL DEFAULT 7;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS quiet_hours_start text;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS quiet_hours_end text;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS match_notifications integer NOT NULL DEFAULT 1;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS message_notifications integer NOT NULL DEFAULT 1;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS safety_notifications integer NOT NULL DEFAULT 1;

ALTER TABLE matchmaking_queue ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT 'id';
ALTER TABLE matchmaking_queue ADD COLUMN IF NOT EXISTS region_mode text NOT NULL DEFAULT 'anywhere';
ALTER TABLE matchmaking_queue ADD COLUMN IF NOT EXISTS safety_snapshot integer NOT NULL DEFAULT 100;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'normal';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS risk_reason text;

ALTER TABLE moderation_appeals ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
ALTER TABLE moderation_appeals ADD COLUMN IF NOT EXISTS updated_at text NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY NOT NULL,
  enabled integer NOT NULL DEFAULT 0,
  rollout_percent integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  updated_by_id text REFERENCES users(id) ON DELETE SET NULL,
  updated_at text NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY NOT NULL,
  value_json text NOT NULL DEFAULT '{}',
  updated_by_id text REFERENCES users(id) ON DELETE SET NULL,
  updated_at text NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE TABLE IF NOT EXISTS announcements (
  id text PRIMARY KEY NOT NULL,
  public_id text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  audience text NOT NULL DEFAULT 'all',
  active_from text NOT NULL,
  active_until text,
  created_by_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at text NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id text NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at text NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_pair_history (
  user_a_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_count integer NOT NULL DEFAULT 0,
  successful_count integer NOT NULL DEFAULT 0,
  skip_count integer NOT NULL DEFAULT 0,
  last_match_at text,
  last_feedback_at text,
  avoid_until text,
  affinity_score integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  PRIMARY KEY (user_a_id, user_b_id)
);

CREATE TABLE IF NOT EXISTS username_history (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username text NOT NULL,
  changed_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS connection_preferences (
  connection_id text NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  favorite integer NOT NULL DEFAULT 0,
  private_note text NOT NULL DEFAULT '',
  muted integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  PRIMARY KEY (connection_id, user_id)
);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id text PRIMARY KEY NOT NULL,
  public_id text NOT NULL,
  report_id text REFERENCES reports(id) ON DELETE SET NULL,
  target_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open',
  severity integer NOT NULL DEFAULT 0,
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  summary text NOT NULL DEFAULT '',
  opened_at text NOT NULL,
  updated_at text NOT NULL,
  closed_at text
);

CREATE TABLE IF NOT EXISTS operational_metrics (
  id text PRIMARY KEY NOT NULL,
  metric_key text NOT NULL,
  metric_value double precision NOT NULL,
  metadata_json text NOT NULL DEFAULT '{}',
  recorded_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS announcements_public_id_unique ON announcements(public_id);
CREATE INDEX IF NOT EXISTS announcements_active_idx ON announcements(active_from, active_until);
CREATE INDEX IF NOT EXISTS pair_history_avoid_idx ON match_pair_history(avoid_until, last_match_at);
CREATE INDEX IF NOT EXISTS username_history_lookup_idx ON username_history(username, changed_at);
CREATE UNIQUE INDEX IF NOT EXISTS moderation_cases_public_id_unique ON moderation_cases(public_id);
CREATE INDEX IF NOT EXISTS moderation_cases_queue_idx ON moderation_cases(status, severity, updated_at);
CREATE INDEX IF NOT EXISTS operational_metrics_key_idx ON operational_metrics(metric_key, recorded_at);
CREATE INDEX IF NOT EXISTS users_safety_idx ON users(safety_band, safety_score, shadow_restricted_until);
CREATE INDEX IF NOT EXISTS sessions_risk_idx ON sessions(user_id, risk_level, created_at);

INSERT INTO feature_flags (key, enabled, rollout_percent, description)
VALUES
  ('matchmaking_v5', 1, 100, 'Weighted V5 matchmaking engine'),
  ('appeals_v5', 1, 100, 'Credential-verified moderation appeal flow'),
  ('announcements_v5', 1, 100, 'In-app owner announcements'),
  ('incognito_v5', 1, 100, 'MAX privacy controls')
ON CONFLICT(key) DO NOTHING;

INSERT INTO system_settings (key, value_json)
VALUES
  ('maintenance', '{"enabled":false,"message":""}'),
  ('matchmaking', '{"enabled":true}'),
  ('messaging', '{"enabled":true}'),
  ('media_uploads', '{"enabled":true}')
ON CONFLICT(key) DO NOTHING;

COMMIT;
