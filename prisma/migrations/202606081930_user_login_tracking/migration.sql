-- Track the lightweight user login metadata collected from Google sign-ins.
ALTER TABLE users
  ADD COLUMN last_login_at DATETIME(3) NULL,
  ADD COLUMN sign_in_count INT NOT NULL DEFAULT 0;
