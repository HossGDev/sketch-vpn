ALTER TABLE "subscriptions" ALTER COLUMN "allowed_regions" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "allowed_regions" SET NOT NULL;