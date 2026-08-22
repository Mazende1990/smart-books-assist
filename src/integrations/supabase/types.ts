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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          company_id: string
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          model: string | null
          status: string
          user_id: string
          user_request: string
        }
        Insert: {
          company_id: string
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          model?: string | null
          status?: string
          user_id: string
          user_request: string
        }
        Update: {
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          model?: string | null
          status?: string
          user_id?: string
          user_request?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tool_calls: {
        Row: {
          approval_granted: boolean | null
          company_id: string
          created_at: string
          duration_ms: number | null
          id: string
          input: Json
          output_summary: string | null
          requires_approval: boolean
          run_id: string
          status: string
          tool_name: string
        }
        Insert: {
          approval_granted?: boolean | null
          company_id: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input?: Json
          output_summary?: string | null
          requires_approval?: boolean
          run_id: string
          status?: string
          tool_name: string
        }
        Update: {
          approval_granted?: boolean | null
          company_id?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input?: Json
          output_summary?: string | null
          requires_approval?: boolean
          run_id?: string
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tool_calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tool_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          action_type: string
          company_id: string
          conversation_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          payload: Json
          requested_by: string | null
          result: Json | null
          run_id: string | null
          status: Database["public"]["Enums"]["approval_status"]
          summary: string
        }
        Insert: {
          action_type: string
          company_id: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          requested_by?: string | null
          result?: Json | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          summary: string
        }
        Update: {
          action_type?: string
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          requested_by?: string | null
          result?: Json | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          approval_granted: boolean | null
          approval_required: boolean
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          parameters: Json
          result_summary: string | null
          status: string
          tool_name: string | null
          user_request: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          approval_granted?: boolean | null
          approval_required?: boolean
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          parameters?: Json
          result_summary?: string | null
          status?: string
          tool_name?: string | null
          user_request?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          approval_granted?: boolean | null
          approval_required?: boolean
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          parameters?: Json
          result_summary?: string | null
          status?: string
          tool_name?: string | null
          user_request?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          country_code: string
          created_at: string
          currency: string
          fiscal_year_start_month: number
          id: string
          is_demo: boolean
          name: string
          org_number: string | null
          updated_at: string
          vat_period: string
          vat_rate: number
        }
        Insert: {
          country_code?: string
          created_at?: string
          currency?: string
          fiscal_year_start_month?: number
          id?: string
          is_demo?: boolean
          name: string
          org_number?: string | null
          updated_at?: string
          vat_period?: string
          vat_rate?: number
        }
        Update: {
          country_code?: string
          created_at?: string
          currency?: string
          fiscal_year_start_month?: number
          id?: string
          is_demo?: boolean
          name?: string
          org_number?: string | null
          updated_at?: string
          vat_period?: string
          vat_rate?: number
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string
          counterparty: string | null
          created_at: string
          currency: string
          document_number: string | null
          due_date: string | null
          extracted: Json | null
          file_size: number | null
          id: string
          issue_date: string | null
          kind: Database["public"]["Enums"]["doc_kind"]
          mime_type: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string | null
          title: string
          total_incl_vat: number | null
          updated_at: string
          uploaded_by: string | null
          vat_amount: number | null
        }
        Insert: {
          company_id: string
          counterparty?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          due_date?: string | null
          extracted?: Json | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          kind?: Database["public"]["Enums"]["doc_kind"]
          mime_type?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          title: string
          total_incl_vat?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vat_amount?: number | null
        }
        Update: {
          company_id?: string
          counterparty?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          due_date?: string | null
          extracted?: Json | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          kind?: Database["public"]["Enums"]["doc_kind"]
          mime_type?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          title?: string
          total_incl_vat?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          company_id: string
          config: Json
          created_at: string
          display_name: string
          id: string
          last_synced_at: string | null
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          last_synced_at?: string | null
          provider: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          company_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_summary: Json
        }
        Insert: {
          company_id: string
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_summary?: Json
        }
        Update: {
          company_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_code: string | null
          amount_excl_vat: number
          booking_date: string
          category: string
          company_id: string
          counterparty: string | null
          created_at: string
          currency: string
          description: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id: string
          notes: string | null
          source: string
          status: Database["public"]["Enums"]["tx_status"]
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          account_code?: string | null
          amount_excl_vat: number
          booking_date: string
          category?: string
          company_id: string
          counterparty?: string | null
          created_at?: string
          currency?: string
          description: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id?: string
          notes?: string | null
          source?: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          account_code?: string | null
          amount_excl_vat?: number
          booking_date?: string
          category?: string
          company_id?: string
          counterparty?: string | null
          created_at?: string
          currency?: string
          description?: string
          direction?: Database["public"]["Enums"]["tx_direction"]
          id?: string
          notes?: string | null
          source?: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_company_role: {
        Args: {
          _company_id: string
          _roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      seed_demo_company: { Args: { _company_id: string }; Returns: undefined }
    }
    Enums: {
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "executed"
        | "expired"
      doc_kind: "supplier_invoice" | "customer_invoice" | "receipt" | "other"
      doc_status: "uploaded" | "processing" | "parsed" | "failed" | "archived"
      integration_status:
        | "not_connected"
        | "coming_soon"
        | "connected"
        | "error"
      member_role: "owner" | "admin" | "accountant" | "viewer"
      tx_direction: "income" | "expense"
      tx_status:
        | "draft"
        | "pending_review"
        | "categorized"
        | "booked"
        | "flagged"
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
    Enums: {
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "executed",
        "expired",
      ],
      doc_kind: ["supplier_invoice", "customer_invoice", "receipt", "other"],
      doc_status: ["uploaded", "processing", "parsed", "failed", "archived"],
      integration_status: [
        "not_connected",
        "coming_soon",
        "connected",
        "error",
      ],
      member_role: ["owner", "admin", "accountant", "viewer"],
      tx_direction: ["income", "expense"],
      tx_status: [
        "draft",
        "pending_review",
        "categorized",
        "booked",
        "flagged",
      ],
    },
  },
} as const
