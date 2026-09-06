CREATE TABLE `detection_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`import_id` text NOT NULL,
	`payload` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `transaction_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_candidates_user_decision` ON `detection_candidates` (`user_id`,`decision`);--> statement-breakpoint
CREATE TABLE `recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`billing_period` text NOT NULL,
	`custom_days` integer,
	`next_payment_at` text,
	`anchor_day` integer,
	`status` text NOT NULL,
	`service_id` text,
	`source` text NOT NULL,
	`confidence` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_user_status` ON `recurring_expenses` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `transaction_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`format` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`transaction_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_imports_user` ON `transaction_imports` (`user_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_merchant` text NOT NULL,
	`normalized_merchant` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`paid_at` text NOT NULL,
	`recurring_expense_id` text,
	`source_import_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`occurrence` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurring_expense_id`) REFERENCES `recurring_expenses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_import_id`) REFERENCES `transaction_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_transactions_dedupe` ON `transactions` (`user_id`,`fingerprint`,`occurrence`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_merchant` ON `transactions` (`user_id`,`normalized_merchant`);--> statement-breakpoint
CREATE INDEX `idx_transactions_expense` ON `transactions` (`recurring_expense_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
