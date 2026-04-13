CREATE TABLE IF NOT EXISTS "scout"."mood_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"title" text NOT NULL,
	"result_tmdb_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mood_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "idx_mood_searches_user_created" ON "scout"."mood_searches" USING btree ("user_id","created_at" DESC);
