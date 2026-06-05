-- GizmoCraft profile/auth layer.
-- Apply on gizmo-server after the existing `players`, `player_stat_snapshots`, and `sync_runs` tables exist.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  email_verified DATETIME(3) NULL,
  name VARCHAR(191) NULL,
  username VARCHAR(191) NOT NULL UNIQUE,
  image VARCHAR(500) NULL,
  role ENUM('PLAYER','ADMIN','VIEWER') NOT NULL DEFAULT 'PLAYER',
  minecraft_uuid VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  INDEX users_minecraft_uuid_idx (minecraft_uuid),
  CONSTRAINT users_minecraft_uuid_fkey FOREIGN KEY (minecraft_uuid) REFERENCES players(uuid) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  type VARCHAR(191) NOT NULL,
  provider VARCHAR(191) NOT NULL,
  provider_account_id VARCHAR(191) NOT NULL,
  refresh_token TEXT NULL,
  access_token TEXT NULL,
  expires_at INT NULL,
  token_type VARCHAR(191) NULL,
  scope VARCHAR(191) NULL,
  id_token TEXT NULL,
  session_state VARCHAR(191) NULL,
  UNIQUE KEY accounts_provider_provider_account_id_key (provider, provider_account_id),
  INDEX accounts_user_id_idx (user_id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  session_token VARCHAR(191) NOT NULL UNIQUE,
  user_id VARCHAR(191) NOT NULL,
  expires DATETIME(3) NOT NULL,
  INDEX sessions_user_id_idx (user_id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(191) NOT NULL,
  token VARCHAR(191) NOT NULL UNIQUE,
  expires DATETIME(3) NOT NULL,
  UNIQUE KEY verification_tokens_identifier_token_key (identifier, token)
);

CREATE TABLE IF NOT EXISTS player_emails (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  player_uuid VARCHAR(36) NOT NULL,
  label VARCHAR(191) NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(191) NOT NULL DEFAULT 'manual',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  INDEX player_emails_player_uuid_idx (player_uuid),
  CONSTRAINT player_emails_player_uuid_fkey FOREIGN KEY (player_uuid) REFERENCES players(uuid) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Existing collector compatibility additions for the live DB.
-- MySQL variants differ on `ADD COLUMN IF NOT EXISTS`, so keep these manual-safe.
-- ALTER TABLE players ADD COLUMN avatar_url VARCHAR(500) NULL;
-- ALTER TABLE players ADD COLUMN total_play_ms BIGINT NOT NULL DEFAULT 0;
-- ALTER TABLE player_stat_snapshots ADD COLUMN blocks_placed INT NOT NULL DEFAULT 0;
-- ALTER TABLE player_stat_snapshots ADD COLUMN items_crafted INT NOT NULL DEFAULT 0;
