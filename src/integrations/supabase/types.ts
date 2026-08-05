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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_music: {
        Row: {
          created_at: string
          id: string
          storage_path: string
          title: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path: string
          title: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string
          title?: string
          uploader_id?: string
        }
        Relationships: []
      }
      important_dates: {
        Row: {
          created_at: string
          creator_id: string
          date: string
          description: string | null
          event_type: string
          id: string
          is_anniversary: boolean
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          date: string
          description?: string | null
          event_type?: string
          id?: string
          is_anniversary?: boolean
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          date?: string
          description?: string | null
          event_type?: string
          id?: string
          is_anniversary?: boolean
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_favorite: boolean
          mood: string | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          mood?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          mood?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      love_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      memories: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          media_path: string
          media_type: string
          media_url: string
          title: string | null
          updated_at: string | null
          uploader_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          media_path: string
          media_type: string
          media_url: string
          title?: string | null
          updated_at?: string | null
          uploader_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          media_path?: string
          media_type?: string
          media_url?: string
          title?: string | null
          updated_at?: string | null
          uploader_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          actor_id: string
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          actor_id?: string
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          partner_name: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          partner_name: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          partner_name?: string
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      surprise_events: {
        Row: {
          created_at: string
          creator_id: string
          end_at: string
          event_type: string
          id: string
          music_path: string | null
          recipient_id: string
          start_at: string
          title: string
          updated_at: string
          voice_path: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          end_at: string
          event_type?: string
          id?: string
          music_path?: string | null
          recipient_id: string
          start_at: string
          title: string
          updated_at?: string
          voice_path?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          end_at?: string
          event_type?: string
          id?: string
          music_path?: string | null
          recipient_id?: string
          start_at?: string
          title?: string
          updated_at?: string
          voice_path?: string | null
        }
        Relationships: []
      }
      surprise_messages: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          position: number
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          position?: number
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "surprise_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "surprise_events"
            referencedColumns: ["id"]
          },
        ]
      }
      surprise_photos: {
        Row: {
          created_at: string
          event_id: string
          id: string
          position: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          position?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "surprise_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "surprise_events"
            referencedColumns: ["id"]
          },
        ]
      }
      surprise_progress: {
        Row: {
          completed: boolean
          event_id: string
          id: string
          opened_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          event_id: string
          id?: string
          opened_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          event_id?: string
          id?: string
          opened_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surprise_progress_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "surprise_events"
            referencedColumns: ["id"]
          },
        ]
      }
      surprise_wishes: {
        Row: {
          author_id: string
          created_at: string
          event_id: string
          id: string
          wish: string
        }
        Insert: {
          author_id: string
          created_at?: string
          event_id: string
          id?: string
          wish: string
        }
        Update: {
          author_id?: string
          created_at?: string
          event_id?: string
          id?: string
          wish?: string
        }
        Relationships: [
          {
            foreignKeyName: "surprise_wishes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "surprise_events"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_messages: {
        Row: {
          audio_path: string | null
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          kind: string
          message: string
          room_id: string
          sender_id: string
        }
        Insert: {
          audio_path?: string | null
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          message: string
          room_id: string
          sender_id: string
        }
        Update: {
          audio_path?: string | null
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          message?: string
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "watch_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_room_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "watch_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_rooms: {
        Row: {
          code: string
          created_at: string
          creator_id: string
          id: string
          is_playing: boolean
          last_sync_at: string
          position_seconds: number
          video_url: string | null
        }
        Insert: {
          code: string
          created_at?: string
          creator_id: string
          id?: string
          is_playing?: boolean
          last_sync_at?: string
          position_seconds?: number
          video_url?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          creator_id?: string
          id?: string
          is_playing?: boolean
          last_sync_at?: string
          position_seconds?: number
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_surprise: { Args: { _event_id: string }; Returns: boolean }
      is_surprise_creator: { Args: { _event_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
