CREATE TABLE "auth_sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detection_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"import_id" text NOT NULL,
	"payload" text NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expense_id" text,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"confidence" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"billing_period" text NOT NULL,
	"custom_days" integer,
	"next_payment_at" text,
	"next_payment_at_source" text,
	"anchor_day" integer,
	"status" text NOT NULL,
	"service_id" text,
	"source" text NOT NULL,
	"confidence" real,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"email" text NOT NULL,
	"tokens" text NOT NULL,
	"status" text NOT NULL,
	"history_months" integer DEFAULT 12 NOT NULL,
	"last_sync_at" text,
	"scan_start" text,
	"scan_end" text,
	"page_token" text,
	"lock_until" bigint DEFAULT 0 NOT NULL,
	"last_error" text,
	"connected_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expense_id" text,
	"receipt_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" text NOT NULL,
	"dismissed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"message_id" text NOT NULL,
	"received_at" text NOT NULL,
	"payload" text,
	"event_type" text NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"expense_id" text,
	"matched_transaction_id" text
);
--> statement-breakpoint
CREATE TABLE "google_identities" (
	"subject" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "integration_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_locks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_enrichments" (
	"expense_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"receipt_id" text NOT NULL,
	"next_payment_at" text,
	"display_name" text,
	"billing_period" text,
	"received_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"original_merchant" text NOT NULL,
	"normalized_merchant" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"paid_at" text NOT NULL,
	"recurring_expense_id" text,
	"source_import_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"occurrence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_candidates" ADD CONSTRAINT "detection_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_candidates" ADD CONSTRAINT "detection_candidates_import_id_transaction_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."transaction_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_evidence" ADD CONSTRAINT "expense_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_evidence" ADD CONSTRAINT "expense_evidence_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_events" ADD CONSTRAINT "gmail_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_events" ADD CONSTRAINT "gmail_events_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_events" ADD CONSTRAINT "gmail_events_receipt_id_gmail_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."gmail_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_receipts" ADD CONSTRAINT "gmail_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_receipts" ADD CONSTRAINT "gmail_receipts_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_receipts" ADD CONSTRAINT "gmail_receipts_matched_transaction_id_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_identities" ADD CONSTRAINT "google_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_imports" ADD CONSTRAINT "transaction_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit" ADD CONSTRAINT "integration_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_locks" ADD CONSTRAINT "integration_locks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_enrichments" ADD CONSTRAINT "provider_enrichments_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_enrichments" ADD CONSTRAINT "provider_enrichments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_enrichments" ADD CONSTRAINT "provider_enrichments_receipt_id_gmail_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."gmail_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_import_id_transaction_imports_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."transaction_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_candidates_user_decision" ON "detection_candidates" USING btree ("user_id","decision");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_evidence_source" ON "expense_evidence" USING btree ("user_id","source","source_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_expense" ON "expense_evidence" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_user_status" ON "recurring_expenses" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gmail_event" ON "gmail_events" USING btree ("receipt_id","type");--> statement-breakpoint
CREATE INDEX "idx_events_user" ON "gmail_events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gmail_message" ON "gmail_receipts" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE INDEX "idx_gmail_pending" ON "gmail_receipts" USING btree ("user_id","decision");--> statement-breakpoint
CREATE INDEX "idx_gmail_expense" ON "gmail_receipts" USING btree ("expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_google_user" ON "google_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_imports_user" ON "transaction_imports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "integration_audit" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transactions_dedupe" ON "transactions" USING btree ("user_id","fingerprint","occurrence");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_merchant" ON "transactions" USING btree ("user_id","normalized_merchant");--> statement-breakpoint
CREATE INDEX "idx_transactions_expense" ON "transactions" USING btree ("recurring_expense_id");