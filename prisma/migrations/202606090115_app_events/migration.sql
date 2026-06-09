-- Track signed-in website user behavior events.
CREATE TABLE IF NOT EXISTS app_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(191) NOT NULL,
  event_type VARCHAR(191) NOT NULL,
  path VARCHAR(191) NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  raw JSON NULL,
  INDEX app_events_user_email_occurred_at_idx (user_email, occurred_at),
  INDEX app_events_event_type_occurred_at_idx (event_type, occurred_at),
  CONSTRAINT app_events_user_email_fkey FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE ON UPDATE CASCADE
);
