ALTER TABLE `users` ADD COLUMN `app_last_seen_at` DATETIME(3) NULL;
CREATE INDEX `users_app_last_seen_at_idx` ON `users`(`app_last_seen_at`);
