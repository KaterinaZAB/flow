CREATE TABLE `auth_sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `expense_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expense_id` text,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`confidence` real NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `recurring_expenses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_source` ON `expense_evidence` (`user_id`,`source`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_evidence_expense` ON `expense_evidence` (`expense_id`);--> statement-breakpoint
CREATE TABLE `gmail_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`email` text NOT NULL,
	`tokens` text NOT NULL,
	`status` text NOT NULL,
	`history_months` integer DEFAULT 12 NOT NULL,
	`last_sync_at` text,
	`scan_start` text,
	`scan_end` text,
	`page_token` text,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`connected_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gmail_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expense_id` text,
	`receipt_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`dismissed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `recurring_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receipt_id`) REFERENCES `gmail_receipts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gmail_event` ON `gmail_events` (`receipt_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_events_user` ON `gmail_events` (`user_id`);--> statement-breakpoint
CREATE TABLE `gmail_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message_id` text NOT NULL,
	`received_at` text NOT NULL,
	`payload` text,
	`event_type` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`expense_id` text,
	`matched_transaction_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `recurring_expenses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`matched_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gmail_message` ON `gmail_receipts` (`user_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `idx_gmail_pending` ON `gmail_receipts` (`user_id`,`decision`);--> statement-breakpoint
CREATE INDEX `idx_gmail_expense` ON `gmail_receipts` (`expense_id`);--> statement-breakpoint
CREATE TABLE `google_identities` (
	`subject` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_google_user` ON `google_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `integration_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `integration_audit` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_enrichments` (
	`expense_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`next_payment_at` text,
	`received_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `recurring_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receipt_id`) REFERENCES `gmail_receipts`(`id`) ON UPDATE no action ON DELETE cascade
);
