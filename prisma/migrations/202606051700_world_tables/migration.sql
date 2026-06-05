-- GizmoCraft world telemetry base tables.
-- This baseline is safe for a fresh MySQL database before applying profile/auth tables.

CREATE TABLE IF NOT EXISTS players (
  uuid VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  first_seen_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NULL,
  total_play_ms BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_stat_snapshots (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_uuid VARCHAR(36) NOT NULL,
  captured_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deaths INT NOT NULL DEFAULT 0,
  mobs_killed INT NOT NULL DEFAULT 0,
  blocks_mined INT NOT NULL DEFAULT 0,
  blocks_placed INT NOT NULL DEFAULT 0,
  items_crafted INT NOT NULL DEFAULT 0,
  diamonds_mined INT NOT NULL DEFAULT 0,
  distance_cm BIGINT NOT NULL DEFAULT 0,
  play_ticks BIGINT NOT NULL DEFAULT 0,
  raw_stats JSON NOT NULL,
  INDEX player_stat_snapshots_captured_at_idx (captured_at),
  INDEX player_stat_snapshots_player_uuid_captured_at_idx (player_uuid, captured_at),
  CONSTRAINT player_stat_snapshots_player_uuid_fkey FOREIGN KEY (player_uuid) REFERENCES players(uuid) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS advancement_unlocks (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_uuid VARCHAR(36) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  unlocked_at DATETIME(3) NULL,
  raw JSON NOT NULL,
  UNIQUE KEY advancement_unlocks_player_uuid_key_key (player_uuid, `key`),
  CONSTRAINT advancement_unlocks_player_uuid_fkey FOREIGN KEY (player_uuid) REFERENCES players(uuid) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS player_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_uuid VARCHAR(36) NOT NULL,
  joined_at DATETIME(3) NOT NULL,
  left_at DATETIME(3) NULL,
  duration_ms BIGINT NULL,
  INDEX player_sessions_player_uuid_joined_at_idx (player_uuid, joined_at),
  CONSTRAINT player_sessions_player_uuid_fkey FOREIGN KEY (player_uuid) REFERENCES players(uuid) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS world_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(191) NOT NULL,
  player_uuid VARCHAR(36) NULL,
  message VARCHAR(191) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  raw JSON NULL,
  INDEX world_events_type_occurred_at_idx (type, occurred_at),
  INDEX world_events_player_uuid_idx (player_uuid)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(191) NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  status VARCHAR(191) NOT NULL,
  details JSON NULL,
  INDEX sync_runs_started_at_idx (started_at)
);
