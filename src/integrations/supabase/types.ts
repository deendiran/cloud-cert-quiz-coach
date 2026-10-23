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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          calls: number
          day: string
          user_id: string
        }
        Insert: {
          calls?: number
          day?: string
          user_id: string
        }
        Update: {
          calls?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          answered_at: string
          attempt_id: string
          chosen_ids: string[]
          difficulty: number
          id: string
          is_correct: boolean
          question_id: string
          seconds_taken: number | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          chosen_ids: string[]
          difficulty: number
          id?: string
          is_correct: boolean
          question_id: string
          seconds_taken?: number | null
          user_id: string
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          chosen_ids?: string[]
          difficulty?: number
          id?: string
          is_correct?: boolean
          question_id?: string
          seconds_taken?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          finished_at: string | null
          id: string
          question_count: number
          question_ids: string[]
          score: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          question_count: number
          question_ids?: string[]
          score?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          question_count?: number
          question_ids?: string[]
          score?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          title?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          language: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          language?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_ids: string[]
          created_at: string
          difficulty: number
          explanation: string
          hint: string | null
          id: string
          is_published: boolean
          memory_hook: string | null
          note_id: string | null
          options: Json
          owner_id: string | null
          source: string
          stem: string
          topic_id: number | null
          topic_label: string | null
          type: string
        }
        Insert: {
          correct_ids: string[]
          created_at?: string
          difficulty?: number
          explanation: string
          hint?: string | null
          id?: string
          is_published?: boolean
          memory_hook?: string | null
          note_id?: string | null
          options: Json
          owner_id?: string | null
          source?: string
          stem: string
          topic_id?: number | null
          topic_label?: string | null
          type?: string
        }
        Update: {
          correct_ids?: string[]
          created_at?: string
          difficulty?: number
          explanation?: string
          hint?: string | null
          id?: string
          is_published?: boolean
          memory_hook?: string | null
          note_id?: string | null
          options?: Json
          owner_id?: string | null
          source?: string
          stem?: string
          topic_id?: number | null
          topic_label?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          id: number
          name: string
          weight: number
        }
        Insert: {
          id?: number
          name: string
          weight?: number
        }
        Update: {
          id?: number
          name?: string
          weight?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          dark_mode: boolean
          dyslexia_font: boolean
          high_contrast: boolean
          large_text: boolean
          read_aloud: boolean
          speech_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          dark_mode?: boolean
          dyslexia_font?: boolean
          high_contrast?: boolean
          large_text?: boolean
          read_aloud?: boolean
          speech_rate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          dark_mode?: boolean
          dyslexia_font?: boolean
          high_contrast?: boolean
          large_text?: boolean
          read_aloud?: boolean
          speech_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      readiness_inputs: {
        Row: {
          answered_at: string | null
          is_correct: boolean | null
          topic: string | null
          user_id: string | null
          w: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "learner"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "learner"],
    },
  },
} as const
