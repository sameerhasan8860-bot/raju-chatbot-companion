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
      tg_jobs: {
        Row: {
          branch: string
          commit_sha: string | null
          conclusion: string | null
          created_at: string
          html_url: string | null
          id: string
          project_id: string
          repository: string
          run_id: number | null
          status: string
          telegram_id: number
          updated_at: string
        }
        Insert: {
          branch: string
          commit_sha?: string | null
          conclusion?: string | null
          created_at?: string
          html_url?: string | null
          id?: string
          project_id: string
          repository: string
          run_id?: number | null
          status?: string
          telegram_id: number
          updated_at?: string
        }
        Update: {
          branch?: string
          commit_sha?: string | null
          conclusion?: string | null
          created_at?: string
          html_url?: string | null
          id?: string
          project_id?: string
          repository?: string
          run_id?: number | null
          status?: string
          telegram_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tg_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tg_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tg_memories: {
        Row: {
          category: string
          content: string
          created_at: string
          id: number
          project: string | null
          search: unknown
          telegram_id: number
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: number
          project?: string | null
          search?: unknown
          telegram_id: number
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: number
          project?: string | null
          search?: unknown
          telegram_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      tg_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          role: string
          telegram_id: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: number
          role: string
          telegram_id: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          role?: string
          telegram_id?: number
        }
        Relationships: []
      }
      tg_projects: {
        Row: {
          created_at: string
          files: Json
          id: string
          runtime: string
          telegram_id: number
          test_command: string
          title: string
        }
        Insert: {
          created_at?: string
          files: Json
          id?: string
          runtime: string
          telegram_id: number
          test_command: string
          title: string
        }
        Update: {
          created_at?: string
          files?: Json
          id?: string
          runtime?: string
          telegram_id?: number
          test_command?: string
          title?: string
        }
        Relationships: []
      }
      tg_updates: {
        Row: {
          created_at: string
          update_id: number
        }
        Insert: {
          created_at?: string
          update_id: number
        }
        Update: {
          created_at?: string
          update_id?: number
        }
        Relationships: []
      }
      tg_users: {
        Row: {
          context_reset_at: string
          created_at: string
          first_name: string | null
          model: string
          telegram_id: number
          updated_at: string
          username: string | null
          window_count: number
          window_start: string
        }
        Insert: {
          context_reset_at?: string
          created_at?: string
          first_name?: string | null
          model?: string
          telegram_id: number
          updated_at?: string
          username?: string | null
          window_count?: number
          window_start?: string
        }
        Update: {
          context_reset_at?: string
          created_at?: string
          first_name?: string | null
          model?: string
          telegram_id?: number
          updated_at?: string
          username?: string | null
          window_count?: number
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
