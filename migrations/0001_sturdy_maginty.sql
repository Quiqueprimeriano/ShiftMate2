CREATE TABLE IF NOT EXISTS "shiftmate_time_off_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"is_full_day" boolean DEFAULT true,
	"reason" text,
	"status" text DEFAULT 'pending',
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shiftmate_time_off_requests" ADD CONSTRAINT "shiftmate_time_off_requests_user_id_shiftmate_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_time_off_requests" ADD CONSTRAINT "shiftmate_time_off_requests_company_id_shiftmate_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."shiftmate_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_time_off_requests" ADD CONSTRAINT "shiftmate_time_off_requests_reviewed_by_shiftmate_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_time_off_user" ON "shiftmate_time_off_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_time_off_company" ON "shiftmate_time_off_requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_time_off_dates" ON "shiftmate_time_off_requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_time_off_status" ON "shiftmate_time_off_requests" USING btree ("status");
