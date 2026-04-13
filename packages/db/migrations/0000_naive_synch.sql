DO $$ BEGIN
 CREATE TYPE "public"."media_type" AS ENUM('movie', 'tv');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."rec_status" AS ENUM('pending', 'accepted', 'dismissed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tier" AS ENUM('free', 'paid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."watching_status" AS ENUM('not_started', 'watching', 'completed', 'dropped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."watchlist_status" AS ENUM('saved', 'dismissed_not_now', 'dismissed_never');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."follows" (
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	CONSTRAINT "follows_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."media_cache" (
	"tmdb_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" text NOT NULL,
	"poster_path" text,
	"backdrop_path" text,
	"year" integer,
	"genres" text[] DEFAULT  NOT NULL,
	"tagline" text,
	"overview" text DEFAULT '' NOT NULL,
	"runtime" integer,
	"vote_average" real,
	"director" text,
	"created_by" text[] DEFAULT  NOT NULL,
	"cast" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_rating" text,
	"number_of_seasons" integer,
	"number_of_episodes" integer,
	"status_text" text,
	"network" text,
	"watch_providers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced" timestamp DEFAULT now() NOT NULL,
	"watch_providers_synced" timestamp,
	CONSTRAINT "media_cache_tmdb_id_media_type_pk" PRIMARY KEY("tmdb_id","media_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."mood_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"title" text NOT NULL,
	"result_tmdb_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"status" "rec_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."survey_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."taste_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"liked_genres" text[] DEFAULT  NOT NULL,
	"disliked_genres" text[] DEFAULT  NOT NULL,
	"liked_themes" text[] DEFAULT  NOT NULL,
	"favorite_actors" text[] DEFAULT  NOT NULL,
	"services" text[] DEFAULT  NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."watch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"watched_at" timestamp DEFAULT now() NOT NULL,
	"overall_score" integer,
	"tags" text[] DEFAULT  NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout"."watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"status" "watchlist_status" DEFAULT 'saved' NOT NULL,
	"resurface_after" date,
	"watching_status" "watching_status" DEFAULT 'not_started' NOT NULL,
	"current_season" integer,
	"current_episode" integer,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_media_unique" UNIQUE("user_id","tmdb_id","media_type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."mood_searches" ADD CONSTRAINT "mood_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."survey_answers" ADD CONSTRAINT "survey_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."taste_profiles" ADD CONSTRAINT "taste_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."usage_logs" ADD CONSTRAINT "usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."watch_history" ADD CONSTRAINT "watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scout"."watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "scout"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
