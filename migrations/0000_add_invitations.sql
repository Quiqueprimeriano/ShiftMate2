CREATE TABLE "shiftmate_companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"owner_name" text NOT NULL,
	"industry" text,
	"size" text,
	"timezone" text DEFAULT 'UTC',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shiftmate_companies_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "shiftmate_employee_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"company_id" integer NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"token" text NOT NULL,
	"invited_by" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shiftmate_employee_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shiftmate_employee_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"weekday_rate" integer NOT NULL,
	"weeknight_rate" integer NOT NULL,
	"saturday_rate" integer NOT NULL,
	"sunday_rate" integer NOT NULL,
	"public_holiday_rate" integer NOT NULL,
	"currency" text DEFAULT 'AUD',
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shiftmate_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shiftmate_public_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shiftmate_public_holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "shiftmate_rate_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"shift_type" text NOT NULL,
	"tier_order" integer NOT NULL,
	"hours_in_tier" numeric(5, 2),
	"rate_per_hour" integer NOT NULL,
	"day_type" text NOT NULL,
	"currency" text DEFAULT 'AUD',
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shiftmate_refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "shiftmate_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shiftmate_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"shift_type" text NOT NULL,
	"notes" text,
	"location" text,
	"status" text DEFAULT 'completed',
	"created_by" integer,
	"approved_by" integer,
	"approved_at" timestamp,
	"is_recurring" boolean DEFAULT false,
	"recurring_pattern" text,
	"recurring_end_date" date,
	"template_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shiftmate_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"user_type" text DEFAULT 'individual' NOT NULL,
	"company_id" integer,
	"role" text,
	"hourly_rate" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shiftmate_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "shiftmate_employee_invitations" ADD CONSTRAINT "shiftmate_employee_invitations_company_id_shiftmate_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."shiftmate_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_employee_invitations" ADD CONSTRAINT "shiftmate_employee_invitations_invited_by_shiftmate_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_employee_rates" ADD CONSTRAINT "shiftmate_employee_rates_user_id_shiftmate_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_employee_rates" ADD CONSTRAINT "shiftmate_employee_rates_company_id_shiftmate_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."shiftmate_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_notifications" ADD CONSTRAINT "shiftmate_notifications_user_id_shiftmate_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_rate_tiers" ADD CONSTRAINT "shiftmate_rate_tiers_company_id_shiftmate_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."shiftmate_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_refresh_tokens" ADD CONSTRAINT "shiftmate_refresh_tokens_user_id_shiftmate_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_shifts" ADD CONSTRAINT "shiftmate_shifts_user_id_shiftmate_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_shifts" ADD CONSTRAINT "shiftmate_shifts_company_id_shiftmate_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."shiftmate_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_shifts" ADD CONSTRAINT "shiftmate_shifts_created_by_shiftmate_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_shifts" ADD CONSTRAINT "shiftmate_shifts_approved_by_shiftmate_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."shiftmate_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shiftmate_users" ADD CONSTRAINT "shiftmate_users_company_id_shiftmate_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."shiftmate_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");