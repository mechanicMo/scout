// GENERATED - do not edit by hand.
// Regenerate with:
//   supabase gen types typescript --project-id efklpylddmczsiwgqpgn --schema scout > packages/shared/src/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  scout: {
    Tables: {
      follows: {
        Row: {
          follower_id: string
          following_id: string
        }
        Insert: {
          follower_id: string
          following_id: string
        }
        Update: {
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      media_cache: {
        Row: {
          backdrop_path: string | null
          cast: Json
          content_rating: string | null
          created_by: string[]
          director: string | null
          genres: string[]
          last_synced: string
          media_type: Database["scout"]["Enums"]["media_type"]
          network: string | null
          number_of_episodes: number | null
          number_of_seasons: number | null
          overview: string
          poster_path: string | null
          runtime: number | null
          status_text: string | null
          tagline: string | null
          title: string
          tmdb_id: number
          vote_average: number | null
          watch_providers: Json
          watch_providers_synced: string | null
          year: number | null
        }
        Insert: {
          backdrop_path?: string | null
          cast?: Json
          content_rating?: string | null
          created_by?: string[]
          director?: string | null
          genres?: string[]
          last_synced?: string
          media_type: Database["scout"]["Enums"]["media_type"]
          network?: string | null
          number_of_episodes?: number | null
          number_of_seasons?: number | null
          overview?: string
          poster_path?: string | null
          runtime?: number | null
          status_text?: string | null
          tagline?: string | null
          title: string
          tmdb_id: number
          vote_average?: number | null
          watch_providers?: Json
          watch_providers_synced?: string | null
          year?: number | null
        }
        Update: {
          backdrop_path?: string | null
          cast?: Json
          content_rating?: string | null
          created_by?: string[]
          director?: string | null
          genres?: string[]
          last_synced?: string
          media_type?: Database["scout"]["Enums"]["media_type"]
          network?: string | null
          number_of_episodes?: number | null
          number_of_seasons?: number | null
          overview?: string
          poster_path?: string | null
          runtime?: number | null
          status_text?: string | null
          tagline?: string | null
          title?: string
          tmdb_id?: number
          vote_average?: number | null
          watch_providers?: Json
          watch_providers_synced?: string | null
          year?: number | null
        }
        Relationships: []
      }
      mood_searches: {
        Row: {
          created_at: string
          id: string
          query: string
          result_tmdb_ids: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          result_tmdb_ids?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          result_tmdb_ids?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_searches_user_id_users_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          generated_at: string
          id: string
          media_type: Database["scout"]["Enums"]["media_type"]
          status: Database["scout"]["Enums"]["rec_status"]
          tmdb_id: number
          user_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          media_type: Database["scout"]["Enums"]["media_type"]
          status?: Database["scout"]["Enums"]["rec_status"]
          tmdb_id: number
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          media_type?: Database["scout"]["Enums"]["media_type"]
          status?: Database["scout"]["Enums"]["rec_status"]
          tmdb_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_answers: {
        Row: {
          answer: string
          answered_at: string
          id: string
          question: string
          user_id: string
        }
        Insert: {
          answer: string
          answered_at?: string
          id?: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string
          answered_at?: string
          id?: string
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_question_state: {
        Row: {
          consumed_at: string | null
          generated_at: string
          id: string
          multi_select: boolean
          options: string[]
          question: string
          queue_order: number
          skip_count: number
          source: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          generated_at?: string
          id?: string
          multi_select?: boolean
          options: string[]
          question: string
          queue_order: number
          skip_count?: number
          source: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          generated_at?: string
          id?: string
          multi_select?: boolean
          options?: string[]
          question?: string
          queue_order?: number
          skip_count?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_question_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      taste_profiles: {
        Row: {
          disliked_genres: string[]
          favorite_actors: string[]
          id: string
          last_updated: string
          liked_genres: string[]
          liked_themes: string[]
          notes: string
          services: string[]
          user_id: string
        }
        Insert: {
          disliked_genres?: string[]
          favorite_actors?: string[]
          id?: string
          last_updated?: string
          liked_genres?: string[]
          liked_themes?: string[]
          notes?: string
          services?: string[]
          user_id: string
        }
        Update: {
          disliked_genres?: string[]
          favorite_actors?: string[]
          id?: string
          last_updated?: string
          liked_genres?: string[]
          liked_themes?: string[]
          notes?: string
          services?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taste_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          tier: Database["scout"]["Enums"]["tier"]
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          tier?: Database["scout"]["Enums"]["tier"]
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          tier?: Database["scout"]["Enums"]["tier"]
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          id: string
          media_type: Database["scout"]["Enums"]["media_type"]
          overall_score: number | null
          tags: string[]
          tmdb_id: number
          user_id: string
          watched_at: string
        }
        Insert: {
          id?: string
          media_type: Database["scout"]["Enums"]["media_type"]
          overall_score?: number | null
          tags?: string[]
          tmdb_id: number
          user_id: string
          watched_at?: string
        }
        Update: {
          id?: string
          media_type?: Database["scout"]["Enums"]["media_type"]
          overall_score?: number | null
          tags?: string[]
          tmdb_id?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          added_at: string
          current_episode: number | null
          current_season: number | null
          id: string
          media_type: Database["scout"]["Enums"]["media_type"]
          resurface_after: string | null
          status: Database["scout"]["Enums"]["watchlist_status"]
          tmdb_id: number
          user_id: string
          watching_status: Database["scout"]["Enums"]["watching_status"]
        }
        Insert: {
          added_at?: string
          current_episode?: number | null
          current_season?: number | null
          id?: string
          media_type: Database["scout"]["Enums"]["media_type"]
          resurface_after?: string | null
          status?: Database["scout"]["Enums"]["watchlist_status"]
          tmdb_id: number
          user_id: string
          watching_status?: Database["scout"]["Enums"]["watching_status"]
        }
        Update: {
          added_at?: string
          current_episode?: number | null
          current_season?: number | null
          id?: string
          media_type?: Database["scout"]["Enums"]["media_type"]
          resurface_after?: string | null
          status?: Database["scout"]["Enums"]["watchlist_status"]
          tmdb_id?: number
          user_id?: string
          watching_status?: Database["scout"]["Enums"]["watching_status"]
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      media_type: "movie" | "tv"
      rec_status: "pending" | "accepted" | "dismissed"
      tier: "free" | "paid"
      watching_status: "not_started" | "watching" | "completed" | "dropped"
      watchlist_status: "saved" | "dismissed_not_now" | "dismissed_never"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  scout: {
    Enums: {
      media_type: ["movie", "tv"],
      rec_status: ["pending", "accepted", "dismissed"],
      tier: ["free", "paid"],
      watching_status: ["not_started", "watching", "completed", "dropped"],
      watchlist_status: ["saved", "dismissed_not_now", "dismissed_never"],
    },
  },
} as const
