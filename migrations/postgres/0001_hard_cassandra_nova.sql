CREATE TABLE "service_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"metadata" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "base_currency" text DEFAULT 'RUB' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" text;--> statement-breakpoint
ALTER TABLE "service_aliases" ADD CONSTRAINT "service_aliases_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;