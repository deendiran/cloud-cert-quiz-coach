export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          language: "en" | "sw";
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          language?: "en" | "sw";
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          language?: "en" | "sw";
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: "admin" | "learner";
        };
        Insert: {
          id?: string;
          user_id: string;
          role: "admin" | "learner";
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: "admin" | "learner";
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          large_text: boolean;
          dyslexia_font: boolean;
          high_contrast: boolean;
          read_aloud: boolean;
          speech_rate: number;
          dark_mode: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          large_text?: boolean;
          dyslexia_font?: boolean;
          high_contrast?: boolean;
          read_aloud?: boolean;
          speech_rate?: number;
          dark_mode?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          large_text?: boolean;
          dyslexia_font?: boolean;
          high_contrast?: boolean;
          read_aloud?: boolean;
          speech_rate?: number;
          dark_mode?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      topics: {
        Row: {
          id: number;
          name: string;
          weight: number;
        };
        Insert: {
          id?: number;
          name: string;
          weight?: number;
        };
        Update: {
          id?: number;
          name?: string;
          weight?: number;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          owner_id: string | null;
          note_id: string | null;
          topic_id: number | null;
          topic_label: string | null;
          difficulty: number;
          type: "mcq" | "true_false" | "multi_select";
          stem: string;
          options: Array<{ id: string; text: string }>;
          correct_ids: string[];
          explanation: string;
          memory_hook: string | null;
          hint: string | null;
          source: "authored" | "ai_generated" | "local_generated";
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          note_id?: string | null;
          topic_id?: number | null;
          topic_label?: string | null;
          difficulty?: number;
          type?: "mcq" | "true_false" | "multi_select";
          stem: string;
          options: Array<{ id: string; text: string }>;
          correct_ids: string[];
          explanation: string;
          memory_hook?: string | null;
          hint?: string | null;
          source?: "authored" | "ai_generated" | "local_generated";
          is_published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          note_id?: string | null;
          topic_id?: number | null;
          topic_label?: string | null;
          difficulty?: number;
          type?: "mcq" | "true_false" | "multi_select";
          stem?: string;
          options?: Array<{ id: string; text: string }>;
          correct_ids?: string[];
          explanation?: string;
          memory_hook?: string | null;
          hint?: string | null;
          source?: "authored" | "ai_generated" | "local_generated";
          is_published?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          user_id: string;
          question_count: number;
          score: number | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_count: number;
          score?: number | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          question_count?: number;
          score?: number | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      answers: {
        Row: {
          id: string;
          attempt_id: string;
          user_id: string;
          question_id: string;
          difficulty: number;
          chosen_ids: string[];
          is_correct: boolean;
          seconds_taken: number | null;
          answered_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          user_id: string;
          question_id: string;
          difficulty: number;
          chosen_ids: string[];
          is_correct: boolean;
          seconds_taken?: number | null;
          answered_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          user_id?: string;
          question_id?: string;
          difficulty?: number;
          chosen_ids?: string[];
          is_correct?: boolean;
          seconds_taken?: number | null;
          answered_at?: string;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          user_id: string;
          day: string;
          calls: number;
        };
        Insert: {
          user_id: string;
          day?: string;
          calls?: number;
        };
        Update: {
          user_id?: string;
          day?: string;
          calls?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      readiness_inputs: {
        Row: {
          user_id: string;
          topic: string | null;
          is_correct: boolean;
          w: number | null;
          answered_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: {
        Args: {
          _user_id: string;
          _role: "admin" | "learner";
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "learner";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
