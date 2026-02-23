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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agreement_assignment_rules: {
        Row: {
          agente_risco: string | null
          cargo_id: string | null
          cbo_codigo: string | null
          created_at: string
          departamento_id: string | null
          evento_disparo: string
          id: string
          is_active: boolean
          prioridade: number
          regra_tipo: string
          template_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agente_risco?: string | null
          cargo_id?: string | null
          cbo_codigo?: string | null
          created_at?: string
          departamento_id?: string | null
          evento_disparo?: string
          id?: string
          is_active?: boolean
          prioridade?: number
          regra_tipo?: string
          template_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agente_risco?: string | null
          cargo_id?: string | null
          cbo_codigo?: string | null
          created_at?: string
          departamento_id?: string | null
          evento_disparo?: string
          id?: string
          is_active?: boolean
          prioridade?: number
          regra_tipo?: string
          template_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_assignment_rules_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_assignment_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agreement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_assignment_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_template_versions: {
        Row: {
          change_summary: string | null
          content_hash: string | null
          content_html: string
          content_plain: string | null
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          published_at: string | null
          template_id: string
          tenant_id: string
          title: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          content_hash?: string | null
          content_html: string
          content_plain?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          published_at?: string | null
          template_id: string
          tenant_id: string
          title: string
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          content_hash?: string | null
          content_html?: string
          content_plain?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          published_at?: string | null
          template_id?: string
          tenant_id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreement_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agreement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_template_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_templates: {
        Row: {
          applies_to_departments: string[] | null
          applies_to_positions: string[] | null
          auto_send_on_admission: boolean
          cargo_id: string | null
          category: string
          cbo_codigo: string | null
          company_group_id: string | null
          company_id: string | null
          conteudo_html: string
          created_at: string
          deleted_at: string | null
          description: string | null
          escopo: string
          exige_assinatura: boolean
          expiry_days: number | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          name: string
          renovacao_obrigatoria: boolean
          requires_witness: boolean
          slug: string
          tenant_id: string
          updated_at: string
          versao: number
        }
        Insert: {
          applies_to_departments?: string[] | null
          applies_to_positions?: string[] | null
          auto_send_on_admission?: boolean
          cargo_id?: string | null
          category?: string
          cbo_codigo?: string | null
          company_group_id?: string | null
          company_id?: string | null
          conteudo_html?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          escopo?: string
          exige_assinatura?: boolean
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name: string
          renovacao_obrigatoria?: boolean
          requires_witness?: boolean
          slug: string
          tenant_id: string
          updated_at?: string
          versao?: number
        }
        Update: {
          applies_to_departments?: string[] | null
          applies_to_positions?: string[] | null
          auto_send_on_admission?: boolean
          cargo_id?: string | null
          category?: string
          cbo_codigo?: string | null
          company_group_id?: string | null
          company_id?: string | null
          conteudo_html?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          escopo?: string
          exige_assinatura?: boolean
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name?: string
          renovacao_obrigatoria?: boolean
          requires_witness?: boolean
          slug?: string
          tenant_id?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreement_templates_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_templates_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "tenant_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      api_analytics_aggregates: {
        Row: {
          avg_response_time_ms: number | null
          client_id: string | null
          created_at: string
          error_breakdown: Json | null
          failed_requests: number
          id: string
          p95_response_time_ms: number | null
          p99_response_time_ms: number | null
          period_start: string
          period_type: string
          rate_limited_requests: number
          successful_requests: number
          tenant_id: string
          top_endpoints: Json | null
          total_requests: number
          unique_endpoints: number
        }
        Insert: {
          avg_response_time_ms?: number | null
          client_id?: string | null
          created_at?: string
          error_breakdown?: Json | null
          failed_requests?: number
          id?: string
          p95_response_time_ms?: number | null
          p99_response_time_ms?: number | null
          period_start: string
          period_type?: string
          rate_limited_requests?: number
          successful_requests?: number
          tenant_id: string
          top_endpoints?: Json | null
          total_requests?: number
          unique_endpoints?: number
        }
        Update: {
          avg_response_time_ms?: number | null
          client_id?: string | null
          created_at?: string
          error_breakdown?: Json | null
          failed_requests?: number
          id?: string
          p95_response_time_ms?: number | null
          p99_response_time_ms?: number | null
          period_start?: string
          period_type?: string
          rate_limited_requests?: number
          successful_requests?: number
          tenant_id?: string
          top_endpoints?: Json | null
          total_requests?: number
          unique_endpoints?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_analytics_aggregates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_analytics_aggregates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_clients: {
        Row: {
          allowed_origins: string[] | null
          client_type: string
          contact_email: string | null
          created_at: string
          created_by: string | null
          description: string | null
          environment: string
          id: string
          metadata: Json | null
          name: string
          status: string
          tenant_id: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          allowed_origins?: string[] | null
          client_type?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string
          id?: string
          metadata?: Json | null
          name: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          allowed_origins?: string[] | null
          client_type?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string
          id?: string
          metadata?: Json | null
          name?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          rate_limit_plan: string
          scopes: string[]
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          rate_limit_plan?: string
          scopes?: string[]
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          rate_limit_plan?: string
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limit_configs: {
        Row: {
          burst_limit: number
          concurrent_limit: number
          created_at: string
          id: string
          is_active: boolean
          plan_tier: string
          requests_per_day: number
          requests_per_hour: number
          requests_per_minute: number
          scope_pattern: string
          updated_at: string
        }
        Insert: {
          burst_limit?: number
          concurrent_limit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          plan_tier: string
          requests_per_day?: number
          requests_per_hour?: number
          requests_per_minute?: number
          scope_pattern?: string
          updated_at?: string
        }
        Update: {
          burst_limit?: number
          concurrent_limit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          plan_tier?: string
          requests_per_day?: number
          requests_per_hour?: number
          requests_per_minute?: number
          scope_pattern?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_scopes: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          requires_approval: boolean
          risk_level: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          requires_approval?: boolean
          risk_level?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          requires_approval?: boolean
          risk_level?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          api_key_id: string | null
          client_id: string | null
          created_at: string
          endpoint: string
          error_code: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          latency_ms: number | null
          metadata: Json | null
          method: string
          module: string | null
          request_scope: string | null
          response_time_ms: number | null
          status_code: number
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          client_id?: string | null
          created_at?: string
          endpoint: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          method: string
          module?: string | null
          request_scope?: string | null
          response_time_ms?: number | null
          status_code: number
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          client_id?: string | null
          created_at?: string
          endpoint?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          method?: string
          module?: string | null
          request_scope?: string | null
          response_time_ms?: number | null
          status_code?: number
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_versions: {
        Row: {
          created_at: string
          deprecated_at: string | null
          id: string
          release_notes: string | null
          status: string
          sunset_at: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          deprecated_at?: string | null
          id?: string
          release_notes?: string | null
          status?: string
          sunset_at?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          deprecated_at?: string | null
          id?: string
          release_notes?: string | null
          status?: string
          sunset_at?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          active_user_id: string | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          impersonation_session_id: string | null
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          real_user_id: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          active_user_id?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          impersonation_session_id?: string | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          real_user_id?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          active_user_id?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          impersonation_session_id?: string | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          real_user_id?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rule_executions: {
        Row: {
          actions_executed: Json
          conditions_met: boolean
          error_message: string | null
          executed_at: string
          id: string
          result: string
          rule_id: string
          tenant_id: string
          trigger_event: string
          trigger_payload: Json | null
        }
        Insert: {
          actions_executed?: Json
          conditions_met: boolean
          error_message?: string | null
          executed_at?: string
          id?: string
          result?: string
          rule_id: string
          tenant_id: string
          trigger_event: string
          trigger_payload?: Json | null
        }
        Update: {
          actions_executed?: Json
          conditions_met?: boolean
          error_message?: string | null
          executed_at?: string
          id?: string
          result?: string
          rule_id?: string
          tenant_id?: string
          trigger_event?: string
          trigger_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rule_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          priority: number
          tenant_id: string
          trigger_count: number
          trigger_event: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          priority?: number
          tenant_id: string
          trigger_count?: number
          trigger_event: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          priority?: number
          tenant_id?: string
          trigger_count?: number
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_plans: {
        Row: {
          base_value: number
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          company_group_id: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          employee_discount_percentage: number | null
          employer_percentage: number | null
          has_coparticipation: boolean | null
          id: string
          integrates_salary: boolean
          is_active: boolean
          is_indemnity: boolean
          legal_basis: string | null
          name: string
          plan_code: string | null
          provider: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_value?: number
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employee_discount_percentage?: number | null
          employer_percentage?: number | null
          has_coparticipation?: boolean | null
          id?: string
          integrates_salary?: boolean
          is_active?: boolean
          is_indemnity?: boolean
          legal_basis?: string | null
          name: string
          plan_code?: string | null
          provider?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_value?: number
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employee_discount_percentage?: number | null
          employer_percentage?: number | null
          has_coparticipation?: boolean | null
          id?: string
          integrates_salary?: boolean
          is_active?: boolean
          is_indemnity?: boolean
          legal_basis?: string | null
          name?: string
          plan_code?: string | null
          provider?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_plans_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_adjustments: {
        Row: {
          adjustment_type: string
          amount_brl: number
          applied_at: string
          applied_by: string | null
          coupon_redemption_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          tenant_id: string
        }
        Insert: {
          adjustment_type: string
          amount_brl: number
          applied_at?: string
          applied_by?: string | null
          coupon_redemption_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          tenant_id: string
        }
        Update: {
          adjustment_type?: string
          amount_brl?: number
          applied_at?: string
          applied_by?: string | null
          coupon_redemption_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_adjustments_coupon_redemption_id_fkey"
            columns: ["coupon_redemption_id"]
            isOneToOne: false
            referencedRelation: "coupon_redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_legal_mappings: {
        Row: {
          adicional_aplicavel: string | null
          career_position_id: string
          created_at: string
          exige_epi: boolean
          exige_exame_medico: boolean
          exige_treinamento: boolean
          id: string
          legal_reference_id: string | null
          nr_codigo: string | null
          piso_salarial_referencia: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adicional_aplicavel?: string | null
          career_position_id: string
          created_at?: string
          exige_epi?: boolean
          exige_exame_medico?: boolean
          exige_treinamento?: boolean
          id?: string
          legal_reference_id?: string | null
          nr_codigo?: string | null
          piso_salarial_referencia?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adicional_aplicavel?: string | null
          career_position_id?: string
          created_at?: string
          exige_epi?: boolean
          exige_exame_medico?: boolean
          exige_treinamento?: boolean
          id?: string
          legal_reference_id?: string | null
          nr_codigo?: string | null
          piso_salarial_referencia?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_legal_mappings_career_position_id_fkey"
            columns: ["career_position_id"]
            isOneToOne: false
            referencedRelation: "career_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_legal_mappings_legal_reference_id_fkey"
            columns: ["legal_reference_id"]
            isOneToOne: false
            referencedRelation: "legal_references"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_legal_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_legal_requirements: {
        Row: {
          base_legal: string | null
          career_position_id: string
          codigo_referencia: string | null
          created_at: string
          descricao: string
          id: string
          obrigatorio: boolean
          periodicidade_meses: number | null
          risco_nao_conformidade: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          base_legal?: string | null
          career_position_id: string
          codigo_referencia?: string | null
          created_at?: string
          descricao: string
          id?: string
          obrigatorio?: boolean
          periodicidade_meses?: number | null
          risco_nao_conformidade?: string | null
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          base_legal?: string | null
          career_position_id?: string
          codigo_referencia?: string | null
          created_at?: string
          descricao?: string
          id?: string
          obrigatorio?: boolean
          periodicidade_meses?: number | null
          risco_nao_conformidade?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_legal_requirements_career_position_id_fkey"
            columns: ["career_position_id"]
            isOneToOne: false
            referencedRelation: "career_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_legal_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_path_steps: {
        Row: {
          career_path_id: string
          career_position_id: string
          created_at: string
          id: string
          ordem: number
          requisitos_transicao: string | null
          tempo_minimo_meses: number | null
          tenant_id: string
        }
        Insert: {
          career_path_id: string
          career_position_id: string
          created_at?: string
          id?: string
          ordem?: number
          requisitos_transicao?: string | null
          tempo_minimo_meses?: number | null
          tenant_id: string
        }
        Update: {
          career_path_id?: string
          career_position_id?: string
          created_at?: string
          id?: string
          ordem?: number
          requisitos_transicao?: string | null
          tempo_minimo_meses?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_path_steps_career_path_id_fkey"
            columns: ["career_path_id"]
            isOneToOne: false
            referencedRelation: "career_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_path_steps_career_position_id_fkey"
            columns: ["career_position_id"]
            isOneToOne: false
            referencedRelation: "career_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_path_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_paths: {
        Row: {
          ativo: boolean
          company_id: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
          trilha_tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tenant_id: string
          trilha_tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          trilha_tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_paths_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_paths_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_positions: {
        Row: {
          ativo: boolean
          cbo_codigo: string | null
          certificacoes_exigidas: string[] | null
          company_group_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          descricao: string | null
          faixa_salarial_max: number | null
          faixa_salarial_min: number | null
          formacao_minima: string | null
          id: string
          nivel: string
          nome: string
          position_id: string | null
          tempo_experiencia_meses: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cbo_codigo?: string | null
          certificacoes_exigidas?: string[] | null
          company_group_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          formacao_minima?: string | null
          id?: string
          nivel?: string
          nome: string
          position_id?: string | null
          tempo_experiencia_meses?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cbo_codigo?: string | null
          certificacoes_exigidas?: string[] | null
          company_group_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          formacao_minima?: string | null
          id?: string
          nivel?: string
          nome?: string
          position_id?: string | null
          tempo_experiencia_meses?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_positions_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_risk_alerts: {
        Row: {
          career_position_id: string | null
          created_at: string
          descricao: string
          employee_id: string | null
          id: string
          metadata: Json | null
          resolvido: boolean
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          tenant_id: string
          tipo_alerta: string
        }
        Insert: {
          career_position_id?: string | null
          created_at?: string
          descricao: string
          employee_id?: string | null
          id?: string
          metadata?: Json | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tenant_id: string
          tipo_alerta: string
        }
        Update: {
          career_position_id?: string | null
          created_at?: string
          descricao?: string
          employee_id?: string | null
          id?: string
          metadata?: Json | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tenant_id?: string
          tipo_alerta?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_risk_alerts_career_position_id_fkey"
            columns: ["career_position_id"]
            isOneToOne: false
            referencedRelation: "career_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_risk_alerts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_risk_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_salary_benchmarks: {
        Row: {
          career_position_id: string
          created_at: string
          fonte: string
          id: string
          observacao: string | null
          referencia_data: string
          tenant_id: string
          valor_maximo: number
          valor_mediano: number
          valor_minimo: number
        }
        Insert: {
          career_position_id: string
          created_at?: string
          fonte?: string
          id?: string
          observacao?: string | null
          referencia_data?: string
          tenant_id: string
          valor_maximo?: number
          valor_mediano?: number
          valor_minimo?: number
        }
        Update: {
          career_position_id?: string
          created_at?: string
          fonte?: string
          id?: string
          observacao?: string | null
          referencia_data?: string
          tenant_id?: string
          valor_maximo?: number
          valor_mediano?: number
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "career_salary_benchmarks_career_position_id_fkey"
            columns: ["career_position_id"]
            isOneToOne: false
            referencedRelation: "career_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_salary_benchmarks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_tracks: {
        Row: {
          ativo: boolean
          cargo_destino_id: string
          cargo_origem_id: string
          created_at: string
          id: string
          requisitos: string | null
          tempo_minimo_meses: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo_destino_id: string
          cargo_origem_id: string
          created_at?: string
          id?: string
          requisitos?: string | null
          tempo_minimo_meses?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo_destino_id?: string
          cargo_origem_id?: string
          created_at?: string
          id?: string
          requisitos?: string | null
          tempo_minimo_meses?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_tracks_cargo_destino_id_fkey"
            columns: ["cargo_destino_id"]
            isOneToOne: false
            referencedRelation: "career_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_tracks_cargo_origem_id_fkey"
            columns: ["cargo_origem_id"]
            isOneToOne: false
            referencedRelation: "career_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_tracks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cbo_catalog: {
        Row: {
          area_ocupacional: string | null
          cbo_codigo: string
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean
          nome_funcao: string
          nrs_relacionadas: number[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          area_ocupacional?: string | null
          cbo_codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome_funcao: string
          nrs_relacionadas?: number[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          area_ocupacional?: string | null
          cbo_codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome_funcao?: string
          nrs_relacionadas?: number[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cbo_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_assist_sessions: {
        Row: {
          assist_mode: Database["public"]["Enums"]["assist_mode"]
          coordinator_id: string
          created_at: string
          ended_at: string | null
          id: string
          session_id: string
          started_at: string
        }
        Insert: {
          assist_mode?: Database["public"]["Enums"]["assist_mode"]
          coordinator_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id: string
          started_at?: string
        }
        Update: {
          assist_mode?: Database["public"]["Enums"]["assist_mode"]
          coordinator_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          session_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_assist_sessions_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_assist_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cnae_cbo_mappings: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          cbo_codigo: string
          cnae_codigo: string
          created_at: string
          id: string
          probabilidade: number
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          cbo_codigo: string
          cnae_codigo: string
          created_at?: string
          id?: string
          probabilidade?: number
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          cbo_codigo?: string
          cnae_codigo?: string
          created_at?: string
          id?: string
          probabilidade?: number
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnae_cbo_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cnae_risk_mappings: {
        Row: {
          agentes_risco_provaveis: string[]
          ambiente: string
          cnae_codigo: string
          created_at: string
          description: string | null
          exige_pgr: boolean
          grau_risco: number
          id: string
          is_custom: boolean
          nrs_aplicaveis: number[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agentes_risco_provaveis?: string[]
          ambiente?: string
          cnae_codigo: string
          created_at?: string
          description?: string | null
          exige_pgr?: boolean
          grau_risco?: number
          id?: string
          is_custom?: boolean
          nrs_aplicaveis?: number[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agentes_risco_provaveis?: string[]
          ambiente?: string
          cnae_codigo?: string
          created_at?: string
          description?: string | null
          exige_pgr?: boolean
          grau_risco?: number
          id?: string
          is_custom?: boolean
          nrs_aplicaveis?: number[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnae_risk_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_agreement_clauses: {
        Row: {
          agreement_id: string
          applies_to_rule_id: string | null
          category: Database["public"]["Enums"]["labor_rule_category"] | null
          clause_number: string
          created_at: string
          description: string | null
          id: string
          is_mandatory: boolean
          override_config: Json | null
          override_fixed_value: number | null
          override_percentage: number | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agreement_id: string
          applies_to_rule_id?: string | null
          category?: Database["public"]["Enums"]["labor_rule_category"] | null
          clause_number: string
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          override_config?: Json | null
          override_fixed_value?: number | null
          override_percentage?: number | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string
          applies_to_rule_id?: string | null
          category?: Database["public"]["Enums"]["labor_rule_category"] | null
          clause_number?: string
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          override_config?: Json | null
          override_fixed_value?: number | null
          override_percentage?: number | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collective_agreement_clauses_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "collective_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_agreement_clauses_applies_to_rule_id_fkey"
            columns: ["applies_to_rule_id"]
            isOneToOne: false
            referencedRelation: "labor_rule_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_agreement_clauses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_agreements: {
        Row: {
          agreement_type: string
          annual_readjustment_pct: number | null
          base_date_month: number | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_url: string | null
          employer_union_name: string | null
          id: string
          jornada_semanal: number | null
          metadata: Json | null
          notes: string | null
          registration_number: string | null
          regras_extras: Json | null
          rule_set_id: string | null
          salary_ceiling: number | null
          salary_floor: number | null
          status: string
          tenant_id: string
          union_cnpj: string | null
          union_name: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          agreement_type?: string
          annual_readjustment_pct?: number | null
          base_date_month?: number | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_url?: string | null
          employer_union_name?: string | null
          id?: string
          jornada_semanal?: number | null
          metadata?: Json | null
          notes?: string | null
          registration_number?: string | null
          regras_extras?: Json | null
          rule_set_id?: string | null
          salary_ceiling?: number | null
          salary_floor?: number | null
          status?: string
          tenant_id: string
          union_cnpj?: string | null
          union_name: string
          updated_at?: string
          valid_from: string
          valid_until: string
        }
        Update: {
          agreement_type?: string
          annual_readjustment_pct?: number | null
          base_date_month?: number | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_url?: string | null
          employer_union_name?: string | null
          id?: string
          jornada_semanal?: number | null
          metadata?: Json | null
          notes?: string | null
          registration_number?: string | null
          regras_extras?: Json | null
          rule_set_id?: string | null
          salary_ceiling?: number | null
          salary_floor?: number | null
          status?: string
          tenant_id?: string
          union_cnpj?: string | null
          union_name?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "collective_agreements_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_agreements_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "labor_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collective_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active_agreement_id: string | null
          address: string | null
          company_group_id: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active_agreement_id?: string | null
          address?: string | null
          company_group_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active_agreement_id?: string | null
          address?: string | null
          company_group_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_active_agreement_id_fkey"
            columns: ["active_agreement_id"]
            isOneToOne: false
            referencedRelation: "collective_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_cnae_profiles: {
        Row: {
          cnae_principal: string
          cnaes_secundarios: string[]
          cnpj: string
          company_id: string
          created_at: string
          descricao_atividade: string
          grau_risco_sugerido: number
          id: string
          raw_response: Json | null
          resolved_at: string | null
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cnae_principal: string
          cnaes_secundarios?: string[]
          cnpj: string
          company_id: string
          created_at?: string
          descricao_atividade?: string
          grau_risco_sugerido?: number
          id?: string
          raw_response?: Json | null
          resolved_at?: string | null
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cnae_principal?: string
          cnaes_secundarios?: string[]
          cnpj?: string
          company_id?: string
          created_at?: string
          descricao_atividade?: string
          grau_risco_sugerido?: number
          id?: string
          raw_response?: Json | null
          resolved_at?: string | null
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cnae_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_cnae_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_evaluations: {
        Row: {
          ai_analysis: string | null
          evaluated_at: string
          evaluated_by: string | null
          id: string
          passed: boolean
          remediation_suggestions: Json | null
          rule_id: string
          tenant_id: string
          violation_count: number
          violations: Json
        }
        Insert: {
          ai_analysis?: string | null
          evaluated_at?: string
          evaluated_by?: string | null
          id?: string
          passed: boolean
          remediation_suggestions?: Json | null
          rule_id: string
          tenant_id: string
          violation_count?: number
          violations?: Json
        }
        Update: {
          ai_analysis?: string | null
          evaluated_at?: string
          evaluated_by?: string | null
          id?: string
          passed?: boolean
          remediation_suggestions?: Json | null
          rule_id?: string
          tenant_id?: string
          violation_count?: number
          violations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "compliance_evaluations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          auto_remediate: boolean
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_evaluated_at: string | null
          last_violation_count: number | null
          name: string
          remediation_action: string | null
          rule_code: string
          rule_config: Json
          severity: Database["public"]["Enums"]["compliance_rule_severity"]
          status: Database["public"]["Enums"]["compliance_rule_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_remediate?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_evaluated_at?: string | null
          last_violation_count?: number | null
          name: string
          remediation_action?: string | null
          rule_code: string
          rule_config?: Json
          severity?: Database["public"]["Enums"]["compliance_rule_severity"]
          status?: Database["public"]["Enums"]["compliance_rule_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_remediate?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_evaluated_at?: string | null
          last_violation_count?: number | null
          name?: string
          remediation_action?: string | null
          rule_code?: string
          rule_config?: Json
          severity?: Database["public"]["Enums"]["compliance_rule_severity"]
          status?: Database["public"]["Enums"]["compliance_rule_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_violations: {
        Row: {
          company_id: string | null
          description: string
          detected_at: string
          employee_id: string
          id: string
          is_resolved: boolean
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          tenant_id: string
          violation_type: string
        }
        Insert: {
          company_id?: string | null
          description: string
          detected_at?: string
          employee_id: string
          id?: string
          is_resolved?: boolean
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tenant_id: string
          violation_type: string
        }
        Update: {
          company_id?: string | null
          description?: string
          detected_at?: string
          employee_id?: string
          id?: string
          is_resolved?: boolean
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tenant_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_violations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_violations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          billing_cycles_remaining: number | null
          coupon_id: string
          created_at: string
          discount_applied_brl: number
          expires_at: string | null
          id: string
          invoice_id: string | null
          plan_id: string | null
          redeemed_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_cycles_remaining?: number | null
          coupon_id: string
          created_at?: string
          discount_applied_brl?: number
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          plan_id?: string | null
          redeemed_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_cycles_remaining?: number | null
          coupon_id?: string
          created_at?: string
          discount_applied_brl?: number
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          plan_id?: string | null
          redeemed_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          allowed_modules: string[] | null
          allowed_payment_methods: string[] | null
          applicable_billing_cycles: string[] | null
          applicable_plan_ids: string[] | null
          applies_to: string
          code: string
          created_at: string
          created_by: string | null
          currency: string
          current_redemptions: number
          description: string | null
          discount_type: string
          discount_value: number
          duration_months: number | null
          id: string
          max_discount_brl: number | null
          max_redemptions: number | null
          max_redemptions_per_tenant: number | null
          min_plan_tier: string | null
          name: string
          status: string
          tenant_scope: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          allowed_modules?: string[] | null
          allowed_payment_methods?: string[] | null
          applicable_billing_cycles?: string[] | null
          applicable_plan_ids?: string[] | null
          applies_to?: string
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_redemptions?: number
          description?: string | null
          discount_type?: string
          discount_value: number
          duration_months?: number | null
          id?: string
          max_discount_brl?: number | null
          max_redemptions?: number | null
          max_redemptions_per_tenant?: number | null
          min_plan_tier?: string | null
          name: string
          status?: string
          tenant_scope?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          allowed_modules?: string[] | null
          allowed_payment_methods?: string[] | null
          applicable_billing_cycles?: string[] | null
          applicable_plan_ids?: string[] | null
          applies_to?: string
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_redemptions?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          duration_months?: number | null
          id?: string
          max_discount_brl?: number | null
          max_redemptions?: number | null
          max_redemptions_per_tenant?: number | null
          min_plan_tier?: string | null
          name?: string
          status?: string
          tenant_scope?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          scope_id: string | null
          scope_type: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          scope_id?: string | null
          scope_type?: string
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          scope_id?: string | null
          scope_type?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          budget: number | null
          company_group_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          company_group_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          company_group_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_accounts: {
        Row: {
          accepted_tos_at: string | null
          accepted_tos_version: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          logo_url: string | null
          metadata: Json | null
          name: string
          status: string
          tier: string
          updated_at: string
          user_id: string
          verification_level: string
          verified: boolean
          website_url: string | null
        }
        Insert: {
          accepted_tos_at?: string | null
          accepted_tos_version?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name: string
          status?: string
          tier?: string
          updated_at?: string
          user_id: string
          verification_level?: string
          verified?: boolean
          website_url?: string | null
        }
        Update: {
          accepted_tos_at?: string | null
          accepted_tos_version?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
          verification_level?: string
          verified?: boolean
          website_url?: string | null
        }
        Relationships: []
      }
      developer_api_subscriptions: {
        Row: {
          app_id: string
          billing_external_id: string | null
          cancelled_at: string | null
          created_at: string
          developer_id: string
          expires_at: string | null
          granted_scopes: string[]
          id: string
          plan_tier: string
          rate_limit_override: number | null
          started_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          app_id: string
          billing_external_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          developer_id: string
          expires_at?: string | null
          granted_scopes?: string[]
          id?: string
          plan_tier?: string
          rate_limit_override?: number | null
          started_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          billing_external_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          developer_id?: string
          expires_at?: string | null
          granted_scopes?: string[]
          id?: string
          plan_tier?: string
          rate_limit_override?: number | null
          started_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_api_subscriptions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_api_subscriptions_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_api_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_app_installations: {
        Row: {
          app_id: string
          config: Json | null
          id: string
          installed_at: string
          installed_by: string
          status: string
          tenant_id: string
          uninstalled_at: string | null
        }
        Insert: {
          app_id: string
          config?: Json | null
          id?: string
          installed_at?: string
          installed_by: string
          status?: string
          tenant_id: string
          uninstalled_at?: string | null
        }
        Update: {
          app_id?: string
          config?: Json | null
          id?: string
          installed_at?: string
          installed_by?: string
          status?: string
          tenant_id?: string
          uninstalled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_app_installations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_app_installations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_app_revenue_entries: {
        Row: {
          app_id: string
          created_at: string
          currency: string
          description: string
          developer_id: string
          entry_type: string
          gross_amount_brl: number
          id: string
          invoice_id: string | null
          metadata: Json | null
          net_amount_brl: number
          period_end: string | null
          period_start: string | null
          platform_commission_brl: number
          platform_commission_pct: number
          tenant_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          currency?: string
          description: string
          developer_id: string
          entry_type: string
          gross_amount_brl?: number
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          net_amount_brl?: number
          period_end?: string | null
          period_start?: string | null
          platform_commission_brl?: number
          platform_commission_pct?: number
          tenant_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          currency?: string
          description?: string
          developer_id?: string
          entry_type?: string
          gross_amount_brl?: number
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          net_amount_brl?: number
          period_end?: string | null
          period_start?: string | null
          platform_commission_brl?: number
          platform_commission_pct?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_app_revenue_entries_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_app_revenue_entries_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_app_revenue_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_app_reviews: {
        Row: {
          app_id: string
          checklist: Json
          completed_at: string | null
          created_at: string
          findings: string[] | null
          id: string
          notes: string | null
          review_stage: string
          reviewer_id: string | null
          reviewer_role: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          app_id: string
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          findings?: string[] | null
          id?: string
          notes?: string | null
          review_stage?: string
          reviewer_id?: string | null
          reviewer_role?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          app_id?: string
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          findings?: string[] | null
          id?: string
          notes?: string | null
          review_stage?: string
          reviewer_id?: string | null
          reviewer_role?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_app_reviews_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_apps: {
        Row: {
          app_status: string
          app_type: string
          category: string
          created_at: string
          description: string | null
          developer_id: string
          homepage_url: string | null
          icon_url: string | null
          id: string
          install_count: number
          long_description: string | null
          name: string
          optional_scopes: string[] | null
          privacy_policy_url: string | null
          published_at: string | null
          rating_avg: number | null
          rating_count: number
          redirect_urls: string[] | null
          requested_scopes: string[] | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshots: string[] | null
          slug: string
          support_url: string | null
          tags: string[] | null
          terms_url: string | null
          updated_at: string
          version: string
          webhook_url: string | null
        }
        Insert: {
          app_status?: string
          app_type?: string
          category?: string
          created_at?: string
          description?: string | null
          developer_id: string
          homepage_url?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          long_description?: string | null
          name: string
          optional_scopes?: string[] | null
          privacy_policy_url?: string | null
          published_at?: string | null
          rating_avg?: number | null
          rating_count?: number
          redirect_urls?: string[] | null
          requested_scopes?: string[] | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshots?: string[] | null
          slug: string
          support_url?: string | null
          tags?: string[] | null
          terms_url?: string | null
          updated_at?: string
          version?: string
          webhook_url?: string | null
        }
        Update: {
          app_status?: string
          app_type?: string
          category?: string
          created_at?: string
          description?: string | null
          developer_id?: string
          homepage_url?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          long_description?: string | null
          name?: string
          optional_scopes?: string[] | null
          privacy_policy_url?: string | null
          published_at?: string | null
          rating_avg?: number | null
          rating_count?: number
          redirect_urls?: string[] | null
          requested_scopes?: string[] | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshots?: string[] | null
          slug?: string
          support_url?: string | null
          tags?: string[] | null
          terms_url?: string | null
          updated_at?: string
          version?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_apps_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_marketplace_listings: {
        Row: {
          app_id: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          featured: boolean
          featured_order: number | null
          id: string
          price_monthly_brl: number | null
          price_yearly_brl: number | null
          pricing_model: string
          supported_modules: string[]
          trial_days: number | null
          updated_at: string
          visibility: string
        }
        Insert: {
          app_id: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          featured?: boolean
          featured_order?: number | null
          id?: string
          price_monthly_brl?: number | null
          price_yearly_brl?: number | null
          pricing_model?: string
          supported_modules?: string[]
          trial_days?: number | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          app_id?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          featured?: boolean
          featured_order?: number | null
          id?: string
          price_monthly_brl?: number | null
          price_yearly_brl?: number | null
          pricing_model?: string
          supported_modules?: string[]
          trial_days?: number | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_marketplace_listings_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: true
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_oauth_clients: {
        Row: {
          app_id: string
          client_id_hash: string
          client_secret_hash: string
          created_at: string
          environment: string
          grant_types: string[]
          id: string
          last_used_at: string | null
          redirect_uris: string[]
          refresh_token_lifetime_seconds: number
          rotated_at: string | null
          scopes: string[]
          status: string
          token_lifetime_seconds: number
          updated_at: string
        }
        Insert: {
          app_id: string
          client_id_hash: string
          client_secret_hash: string
          created_at?: string
          environment?: string
          grant_types?: string[]
          id?: string
          last_used_at?: string | null
          redirect_uris?: string[]
          refresh_token_lifetime_seconds?: number
          rotated_at?: string | null
          scopes?: string[]
          status?: string
          token_lifetime_seconds?: number
          updated_at?: string
        }
        Update: {
          app_id?: string
          client_id_hash?: string
          client_secret_hash?: string
          created_at?: string
          environment?: string
          grant_types?: string[]
          id?: string
          last_used_at?: string | null
          redirect_uris?: string[]
          refresh_token_lifetime_seconds?: number
          rotated_at?: string | null
          scopes?: string[]
          status?: string
          token_lifetime_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_oauth_clients_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_sandbox_sessions: {
        Row: {
          api_base_url: string
          app_id: string
          billing_blocked: boolean
          config: Json | null
          created_at: string
          developer_id: string
          environment_id: string
          expires_at: string
          id: string
          sandbox_api_key_hash: string
          sandbox_tenant_id: string
          seed_data_template: string | null
          status: string
        }
        Insert: {
          api_base_url: string
          app_id: string
          billing_blocked?: boolean
          config?: Json | null
          created_at?: string
          developer_id: string
          environment_id: string
          expires_at: string
          id?: string
          sandbox_api_key_hash: string
          sandbox_tenant_id: string
          seed_data_template?: string | null
          status?: string
        }
        Update: {
          api_base_url?: string
          app_id?: string
          billing_blocked?: boolean
          config?: Json | null
          created_at?: string
          developer_id?: string
          environment_id?: string
          expires_at?: string
          id?: string
          sandbox_api_key_hash?: string
          sandbox_tenant_id?: string
          seed_data_template?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_sandbox_sessions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "developer_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_sandbox_sessions_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      display_connection_logs: {
        Row: {
          created_at: string
          display_id: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string | null
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          display_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          display_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_connection_logs_display_id_fkey"
            columns: ["display_id"]
            isOneToOne: false
            referencedRelation: "live_displays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_connection_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_connection_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "live_display_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      display_event_queue: {
        Row: {
          channel: string
          created_at: string
          event_type: string
          expires_at: string
          id: string
          payload: Json
          priority: number
          processed: boolean
          source: string
          tenant_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          event_type?: string
          expires_at?: string
          id?: string
          payload?: Json
          priority?: number
          processed?: boolean
          source?: string
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_type?: string
          expires_at?: string
          id?: string
          payload?: Json
          priority?: number
          processed?: boolean
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_event_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      display_sessions: {
        Row: {
          channel_name: string
          connected_at: string
          display_id: string
          id: string
          last_heartbeat: string
          metadata: Json | null
          status: string
          tenant_id: string
        }
        Insert: {
          channel_name: string
          connected_at?: string
          display_id: string
          id?: string
          last_heartbeat?: string
          metadata?: Json | null
          status?: string
          tenant_id: string
        }
        Update: {
          channel_name?: string
          connected_at?: string
          display_id?: string
          id?: string
          last_heartbeat?: string
          metadata?: Json | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          access_result: string
          accessed_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          requester_document: string | null
          requester_email: string | null
          requester_name: string | null
          requester_purpose: string | null
          signed_document_id: string | null
          tenant_id: string
          token_id: string
          user_agent: string | null
        }
        Insert: {
          access_result?: string
          accessed_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          requester_document?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_purpose?: string | null
          signed_document_id?: string | null
          tenant_id: string
          token_id: string
          user_agent?: string | null
        }
        Update: {
          access_result?: string
          accessed_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          requester_document?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_purpose?: string | null
          signed_document_id?: string | null
          tenant_id?: string
          token_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "document_validation_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      document_validation_tokens: {
        Row: {
          agreement_id: string | null
          company_id: string | null
          created_at: string
          document_hash: string
          document_vault_id: string
          employee_id: string | null
          expires_at: string | null
          id: string
          issued_at: string
          metadata: Json | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          agreement_id?: string | null
          company_id?: string | null
          created_at?: string
          document_hash: string
          document_vault_id: string
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          metadata?: Json | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          agreement_id?: string | null
          company_id?: string | null
          created_at?: string
          document_hash?: string
          document_vault_id?: string
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          metadata?: Json | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_validation_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_vault: {
        Row: {
          agreement_id: string | null
          assinatura_valida: boolean
          company_group_id: string | null
          company_id: string | null
          created_at: string
          employee_id: string
          hash_documento: string | null
          id: string
          ip_assinatura: string | null
          nome_documento: string
          tenant_id: string
          tipo_documento: string
          updated_at: string
          url_arquivo: string
          versao: number | null
        }
        Insert: {
          agreement_id?: string | null
          assinatura_valida?: boolean
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          employee_id: string
          hash_documento?: string | null
          id?: string
          ip_assinatura?: string | null
          nome_documento: string
          tenant_id: string
          tipo_documento?: string
          updated_at?: string
          url_arquivo: string
          versao?: number | null
        }
        Update: {
          agreement_id?: string | null
          assinatura_valida?: boolean
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          employee_id?: string
          hash_documento?: string | null
          id?: string
          ip_assinatura?: string | null
          nome_documento?: string
          tenant_id?: string
          tipo_documento?: string
          updated_at?: string
          url_arquivo?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_vault_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "employee_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_vault_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_vault_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_vault_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_vault_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_addresses: {
        Row: {
          address_type: string
          bairro: string | null
          cep: string | null
          cidade: string
          complemento: string | null
          created_at: string
          deleted_at: string | null
          employee_id: string
          id: string
          is_primary: boolean
          logradouro: string
          numero: string | null
          pais: string
          tenant_id: string
          uf: string
          updated_at: string
        }
        Insert: {
          address_type?: string
          bairro?: string | null
          cep?: string | null
          cidade: string
          complemento?: string | null
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          is_primary?: boolean
          logradouro: string
          numero?: string | null
          pais?: string
          tenant_id: string
          uf: string
          updated_at?: string
        }
        Update: {
          address_type?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          is_primary?: boolean
          logradouro?: string
          numero?: string | null
          pais?: string
          tenant_id?: string
          uf?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_addresses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_addresses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_agreements: {
        Row: {
          cancelled_at: string | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          employee_id: string
          expires_at: string | null
          external_document_id: string | null
          external_signing_url: string | null
          id: string
          ip_address: string | null
          refusal_reason: string | null
          refused_at: string | null
          sent_at: string | null
          sent_by: string | null
          signature_provider: string | null
          signed_at: string | null
          signed_document_hash: string | null
          signed_document_url: string | null
          status: string
          template_id: string
          template_version_id: string
          tenant_id: string
          updated_at: string
          user_agent: string | null
          versao: number
          viewed_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          employee_id: string
          expires_at?: string | null
          external_document_id?: string | null
          external_signing_url?: string | null
          id?: string
          ip_address?: string | null
          refusal_reason?: string | null
          refused_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          signature_provider?: string | null
          signed_at?: string | null
          signed_document_hash?: string | null
          signed_document_url?: string | null
          status?: string
          template_id: string
          template_version_id: string
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
          versao?: number
          viewed_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          employee_id?: string
          expires_at?: string | null
          external_document_id?: string | null
          external_signing_url?: string | null
          id?: string
          ip_address?: string | null
          refusal_reason?: string | null
          refused_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          signature_provider?: string | null
          signed_at?: string | null
          signed_document_hash?: string | null
          signed_document_url?: string | null
          status?: string
          template_id?: string
          template_version_id?: string
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
          versao?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_agreements_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agreements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agreements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agreement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agreements_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_benefits: {
        Row: {
          benefit_plan_id: string
          cancellation_date: string | null
          card_number: string | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          custom_value: number | null
          deleted_at: string | null
          dependents_count: number | null
          employee_discount_pct: number | null
          employee_id: string
          employer_pays_pct: number | null
          enrollment_date: string
          id: string
          is_active: boolean
          monthly_value: number | null
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          benefit_plan_id: string
          cancellation_date?: string | null
          card_number?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_value?: number | null
          deleted_at?: string | null
          dependents_count?: number | null
          employee_discount_pct?: number | null
          employee_id: string
          employer_pays_pct?: number | null
          enrollment_date?: string
          id?: string
          is_active?: boolean
          monthly_value?: number | null
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          benefit_plan_id?: string
          cancellation_date?: string | null
          card_number?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_value?: number | null
          deleted_at?: string | null
          dependents_count?: number | null
          employee_discount_pct?: number | null
          employee_id?: string
          employer_pays_pct?: number | null
          enrollment_date?: string
          id?: string
          is_active?: boolean
          monthly_value?: number | null
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_benefits_benefit_plan_id_fkey"
            columns: ["benefit_plan_id"]
            isOneToOne: false
            referencedRelation: "benefit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefits_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_benefits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contracts: {
        Row: {
          admission_date: string
          cbo_code: string | null
          collective_agreement_id: string | null
          company_id: string | null
          contract_end_date: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          departamento: string | null
          employee_id: string
          end_reason: string | null
          ended_at: string | null
          esocial_category:
            | Database["public"]["Enums"]["esocial_category"]
            | null
          esocial_matricula: string | null
          experience_end_date: string | null
          fgts_regime: Database["public"]["Enums"]["fgts_regime"]
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          indicativo_inss: boolean
          is_current: boolean
          is_night_shift: boolean
          job_function: string | null
          jornada_tipo: Database["public"]["Enums"]["jornada_tipo"] | null
          salario_base: number | null
          shift_description: string | null
          started_at: string
          tenant_id: string
          tipo_salario: Database["public"]["Enums"]["tipo_salario"] | null
          union_code: string | null
          union_name: string | null
          updated_at: string
          weekly_hours: number
          work_regime: Database["public"]["Enums"]["work_regime"]
        }
        Insert: {
          admission_date: string
          cbo_code?: string | null
          collective_agreement_id?: string | null
          company_id?: string | null
          contract_end_date?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          departamento?: string | null
          employee_id: string
          end_reason?: string | null
          ended_at?: string | null
          esocial_category?:
            | Database["public"]["Enums"]["esocial_category"]
            | null
          esocial_matricula?: string | null
          experience_end_date?: string | null
          fgts_regime?: Database["public"]["Enums"]["fgts_regime"]
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          indicativo_inss?: boolean
          is_current?: boolean
          is_night_shift?: boolean
          job_function?: string | null
          jornada_tipo?: Database["public"]["Enums"]["jornada_tipo"] | null
          salario_base?: number | null
          shift_description?: string | null
          started_at: string
          tenant_id: string
          tipo_salario?: Database["public"]["Enums"]["tipo_salario"] | null
          union_code?: string | null
          union_name?: string | null
          updated_at?: string
          weekly_hours?: number
          work_regime?: Database["public"]["Enums"]["work_regime"]
        }
        Update: {
          admission_date?: string
          cbo_code?: string | null
          collective_agreement_id?: string | null
          company_id?: string | null
          contract_end_date?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          departamento?: string | null
          employee_id?: string
          end_reason?: string | null
          ended_at?: string | null
          esocial_category?:
            | Database["public"]["Enums"]["esocial_category"]
            | null
          esocial_matricula?: string | null
          experience_end_date?: string | null
          fgts_regime?: Database["public"]["Enums"]["fgts_regime"]
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          indicativo_inss?: boolean
          is_current?: boolean
          is_night_shift?: boolean
          job_function?: string | null
          jornada_tipo?: Database["public"]["Enums"]["jornada_tipo"] | null
          salario_base?: number | null
          shift_description?: string | null
          started_at?: string
          tenant_id?: string
          tipo_salario?: Database["public"]["Enums"]["tipo_salario"] | null
          union_code?: string | null
          union_name?: string | null
          updated_at?: string
          weekly_hours?: number
          work_regime?: Database["public"]["Enums"]["work_regime"]
        }
        Relationships: [
          {
            foreignKeyName: "employee_contracts_collective_agreement_id_fkey"
            columns: ["collective_agreement_id"]
            isOneToOne: false
            referencedRelation: "collective_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_data_access_logs: {
        Row: {
          access_type: string
          accessed_by: string
          accessed_fields: string[] | null
          created_at: string
          data_scope: string
          employee_id: string
          id: string
          ip_address: string | null
          justification: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_by: string
          accessed_fields?: string[] | null
          created_at?: string
          data_scope?: string
          employee_id: string
          id?: string
          ip_address?: string | null
          justification?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_by?: string
          accessed_fields?: string[] | null
          created_at?: string
          data_scope?: string
          employee_id?: string
          id?: string
          ip_address?: string | null
          justification?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_data_access_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_data_access_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_dependents: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          dependente_salario_familia: boolean
          employee_id: string
          end_date: string | null
          has_disability: boolean
          id: string
          is_benefit_dependent: boolean
          is_ir_dependent: boolean
          name: string
          relationship: Database["public"]["Enums"]["employee_dependent_type"]
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          dependente_salario_familia?: boolean
          employee_id: string
          end_date?: string | null
          has_disability?: boolean
          id?: string
          is_benefit_dependent?: boolean
          is_ir_dependent?: boolean
          name: string
          relationship: Database["public"]["Enums"]["employee_dependent_type"]
          start_date?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          dependente_salario_familia?: boolean
          employee_id?: string
          end_date?: string | null
          has_disability?: boolean
          id?: string
          is_benefit_dependent?: boolean
          is_ir_dependent?: boolean
          name?: string
          relationship?: Database["public"]["Enums"]["employee_dependent_type"]
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_dependents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_dependents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string | null
          created_at: string
          deleted_at: string | null
          document_number: string
          document_type: Database["public"]["Enums"]["employee_document_type"]
          employee_id: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          issuing_state: string | null
          metadata: Json | null
          section: string | null
          series: string | null
          tenant_id: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          document_number: string
          document_type: Database["public"]["Enums"]["employee_document_type"]
          employee_id: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          issuing_state?: string | null
          metadata?: Json | null
          section?: string | null
          series?: string | null
          tenant_id: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          document_number?: string
          document_type?: Database["public"]["Enums"]["employee_document_type"]
          employee_id?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          issuing_state?: string | null
          metadata?: Json | null
          section?: string | null
          series?: string | null
          tenant_id?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_events: {
        Row: {
          created_at: string
          employee_id: string
          event_type: Database["public"]["Enums"]["employee_event_type"]
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          event_type: Database["public"]["Enums"]["employee_event_type"]
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          event_type?: Database["public"]["Enums"]["employee_event_type"]
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_health_exams: {
        Row: {
          cbo_code: string | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          exam_date: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          expiry_date: string | null
          health_program_id: string | null
          id: string
          is_valid: boolean
          next_exam_date: string | null
          observations: string | null
          physician_crm: string | null
          physician_name: string | null
          result: Database["public"]["Enums"]["exam_result"]
          risk_factors_evaluated: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cbo_code?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          exam_date: string
          exam_type: Database["public"]["Enums"]["exam_type"]
          expiry_date?: string | null
          health_program_id?: string | null
          id?: string
          is_valid?: boolean
          next_exam_date?: string | null
          observations?: string | null
          physician_crm?: string | null
          physician_name?: string | null
          result?: Database["public"]["Enums"]["exam_result"]
          risk_factors_evaluated?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cbo_code?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          exam_date?: string
          exam_type?: Database["public"]["Enums"]["exam_type"]
          expiry_date?: string | null
          health_program_id?: string | null
          id?: string
          is_valid?: boolean
          next_exam_date?: string | null
          observations?: string | null
          physician_crm?: string | null
          physician_name?: string | null
          result?: Database["public"]["Enums"]["exam_result"]
          risk_factors_evaluated?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_health_exams_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_health_exams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_health_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_health_exams_health_program_id_fkey"
            columns: ["health_program_id"]
            isOneToOne: false
            referencedRelation: "health_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_health_exams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll_items: {
        Row: {
          amount: number
          catalog_item_id: string
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          end_date: string | null
          id: string
          is_active: boolean
          percentage: number | null
          reference_value: string | null
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          catalog_item_id: string
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          percentage?: number | null
          reference_value?: string | null
          start_date?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          catalog_item_id?: string
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          percentage?: number | null
          reference_value?: string | null
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_item_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_items_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_personal_data: {
        Row: {
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          cnh_categoria: string | null
          cnh_numero: string | null
          cnh_validade: string | null
          conta: string | null
          cpf: string
          created_at: string
          data_nascimento: string
          deleted_at: string | null
          employee_id: string
          estado_civil: Database["public"]["Enums"]["employee_estado_civil"]
          id: string
          municipio_nascimento: string | null
          nacionalidade: string
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          nome_social: string | null
          pais_nascimento: string
          passaporte: string | null
          pis_pasep_nit: string | null
          rg_data_emissao: string | null
          rg_numero: string | null
          rg_orgao_emissor: string | null
          rg_uf: string | null
          rne_rnm: string | null
          sexo: Database["public"]["Enums"]["employee_sexo"]
          tenant_id: string
          tipo_conta: string | null
          uf_nascimento: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          conta?: string | null
          cpf: string
          created_at?: string
          data_nascimento: string
          deleted_at?: string | null
          employee_id: string
          estado_civil?: Database["public"]["Enums"]["employee_estado_civil"]
          id?: string
          municipio_nascimento?: string | null
          nacionalidade?: string
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          nome_social?: string | null
          pais_nascimento?: string
          passaporte?: string | null
          pis_pasep_nit?: string | null
          rg_data_emissao?: string | null
          rg_numero?: string | null
          rg_orgao_emissor?: string | null
          rg_uf?: string | null
          rne_rnm?: string | null
          sexo?: Database["public"]["Enums"]["employee_sexo"]
          tenant_id: string
          tipo_conta?: string | null
          uf_nascimento?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_validade?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string
          data_nascimento?: string
          deleted_at?: string | null
          employee_id?: string
          estado_civil?: Database["public"]["Enums"]["employee_estado_civil"]
          id?: string
          municipio_nascimento?: string | null
          nacionalidade?: string
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          nome_social?: string | null
          pais_nascimento?: string
          passaporte?: string | null
          pis_pasep_nit?: string | null
          rg_data_emissao?: string | null
          rg_numero?: string | null
          rg_orgao_emissor?: string | null
          rg_uf?: string | null
          rne_rnm?: string | null
          sexo?: Database["public"]["Enums"]["employee_sexo"]
          tenant_id?: string
          tipo_conta?: string | null
          uf_nascimento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_personal_data_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_personal_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_records: {
        Row: {
          created_at: string
          data_admissao: string
          data_desligamento: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          matricula_interna: string
          status: Database["public"]["Enums"]["employee_record_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_admissao: string
          data_desligamento?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          matricula_interna: string
          status?: Database["public"]["Enums"]["employee_record_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_admissao?: string
          data_desligamento?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          matricula_interna?: string
          status?: Database["public"]["Enums"]["employee_record_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_risk_exposures: {
        Row: {
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          end_date: string | null
          epi_ca_number: string | null
          epi_description: string | null
          exposure_group_id: string | null
          generates_hazard_pay: boolean
          hazard_pay_percentage: number | null
          hazard_pay_type: string | null
          id: string
          is_active: boolean
          notes: string | null
          requires_epi: boolean
          risk_factor_id: string
          risk_level: string
          risk_score: number | null
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          end_date?: string | null
          epi_ca_number?: string | null
          epi_description?: string | null
          exposure_group_id?: string | null
          generates_hazard_pay?: boolean
          hazard_pay_percentage?: number | null
          hazard_pay_type?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          requires_epi?: boolean
          risk_factor_id: string
          risk_level?: string
          risk_score?: number | null
          start_date?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          end_date?: string | null
          epi_ca_number?: string | null
          epi_description?: string | null
          exposure_group_id?: string | null
          generates_hazard_pay?: boolean
          hazard_pay_percentage?: number | null
          hazard_pay_type?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          requires_epi?: boolean
          risk_factor_id?: string
          risk_level?: string
          risk_score?: number | null
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_risk_exposures_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_risk_exposures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_risk_exposures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_risk_exposures_exposure_group_id_fkey"
            columns: ["exposure_group_id"]
            isOneToOne: false
            referencedRelation: "exposure_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_risk_exposures_risk_factor_id_fkey"
            columns: ["risk_factor_id"]
            isOneToOne: false
            referencedRelation: "occupational_risk_factors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_risk_exposures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          base_salary: number | null
          company_group_id: string | null
          company_id: string
          cpf: string | null
          created_at: string
          current_salary: number | null
          deleted_at: string | null
          department_id: string | null
          email: string | null
          exposure_group_id: string | null
          hire_date: string | null
          id: string
          manager_id: string | null
          name: string
          operacao_restrita: boolean
          phone: string | null
          position_id: string | null
          restricao_motivo: Json | null
          status: Database["public"]["Enums"]["employee_status"]
          status_operacional: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          base_salary?: number | null
          company_group_id?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          current_salary?: number | null
          deleted_at?: string | null
          department_id?: string | null
          email?: string | null
          exposure_group_id?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          name: string
          operacao_restrita?: boolean
          phone?: string | null
          position_id?: string | null
          restricao_motivo?: Json | null
          status?: Database["public"]["Enums"]["employee_status"]
          status_operacional?: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          base_salary?: number | null
          company_group_id?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          current_salary?: number | null
          deleted_at?: string | null
          department_id?: string | null
          email?: string | null
          exposure_group_id?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          operacao_restrita?: boolean
          phone?: string | null
          position_id?: string | null
          restricao_motivo?: Json | null
          status?: Database["public"]["Enums"]["employee_status"]
          status_operacional?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_exposure_group_id_fkey"
            columns: ["exposure_group_id"]
            isOneToOne: false
            referencedRelation: "exposure_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_alerts: {
        Row: {
          alert_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_resolved: boolean
          message: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          tenant_id: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tenant_id: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_asset_returns: {
        Row: {
          asset_id: string | null
          condicao: string
          created_at: string
          data_retorno: string
          delivery_id: string | null
          employee_id: string
          epi_catalog_id: string
          executor_user_id: string | null
          id: string
          metadata: Json | null
          motivo: string
          observacoes: string | null
          reintegrado_estoque: boolean
          tenant_id: string
        }
        Insert: {
          asset_id?: string | null
          condicao: string
          created_at?: string
          data_retorno?: string
          delivery_id?: string | null
          employee_id: string
          epi_catalog_id: string
          executor_user_id?: string | null
          id?: string
          metadata?: Json | null
          motivo: string
          observacoes?: string | null
          reintegrado_estoque?: boolean
          tenant_id: string
        }
        Update: {
          asset_id?: string | null
          condicao?: string
          created_at?: string
          data_retorno?: string
          delivery_id?: string | null
          employee_id?: string
          epi_catalog_id?: string
          executor_user_id?: string | null
          id?: string
          metadata?: Json | null
          motivo?: string
          observacoes?: string | null
          reintegrado_estoque?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_asset_returns_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "epi_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_asset_returns_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_asset_returns_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_asset_returns_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_asset_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_assets: {
        Row: {
          created_at: string
          data_entrega: string | null
          data_retorno: string | null
          delivery_id: string | null
          employee_id: string | null
          epi_catalog_id: string
          id: string
          lot_id: string | null
          metadata: Json | null
          serial_number: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_entrega?: string | null
          data_retorno?: string | null
          delivery_id?: string | null
          employee_id?: string | null
          epi_catalog_id: string
          id?: string
          lot_id?: string | null
          metadata?: Json | null
          serial_number: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_entrega?: string | null
          data_retorno?: string | null
          delivery_id?: string | null
          employee_id?: string | null
          epi_catalog_id?: string
          id?: string
          lot_id?: string | null
          metadata?: Json | null
          serial_number?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_assets_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_assets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_assets_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_assets_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "epi_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_audit_log: {
        Row: {
          action: string
          created_at: string
          delivery_id: string | null
          details: string | null
          employee_id: string | null
          entity_id: string | null
          entity_type: string | null
          epi_catalog_id: string | null
          executor: string
          executor_user_id: string | null
          hash_documento: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          delivery_id?: string | null
          details?: string | null
          employee_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          epi_catalog_id?: string | null
          executor?: string
          executor_user_id?: string | null
          hash_documento?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          delivery_id?: string | null
          details?: string | null
          employee_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          epi_catalog_id?: string | null
          executor?: string
          executor_user_id?: string | null
          hash_documento?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_audit_log_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_audit_log_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_catalog: {
        Row: {
          ca_numero: string | null
          ca_validade: string | null
          categoria: string
          created_at: string
          descricao: string | null
          exige_lote: boolean
          exige_termo_assinatura: boolean
          fabricante: string | null
          foto_url: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          modelo: string | null
          nome: string
          nr_referencia: number | null
          nr_treinamento_codigo: number | null
          periodicidade_substituicao_dias: number | null
          rastreavel_individualmente: boolean
          requer_treinamento: boolean | null
          risco_relacionado: string[]
          tenant_id: string
          tipo: string
          updated_at: string
          validade_meses: number | null
          vida_util_dias: number | null
        }
        Insert: {
          ca_numero?: string | null
          ca_validade?: string | null
          categoria?: string
          created_at?: string
          descricao?: string | null
          exige_lote?: boolean
          exige_termo_assinatura?: boolean
          fabricante?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          modelo?: string | null
          nome: string
          nr_referencia?: number | null
          nr_treinamento_codigo?: number | null
          periodicidade_substituicao_dias?: number | null
          rastreavel_individualmente?: boolean
          requer_treinamento?: boolean | null
          risco_relacionado?: string[]
          tenant_id: string
          tipo?: string
          updated_at?: string
          validade_meses?: number | null
          vida_util_dias?: number | null
        }
        Update: {
          ca_numero?: string | null
          ca_validade?: string | null
          categoria?: string
          created_at?: string
          descricao?: string | null
          exige_lote?: boolean
          exige_termo_assinatura?: boolean
          fabricante?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          modelo?: string | null
          nome?: string
          nr_referencia?: number | null
          nr_treinamento_codigo?: number | null
          periodicidade_substituicao_dias?: number | null
          rastreavel_individualmente?: boolean
          requer_treinamento?: boolean | null
          risco_relacionado?: string[]
          tenant_id?: string
          tipo?: string
          updated_at?: string
          validade_meses?: number | null
          vida_util_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_deliveries: {
        Row: {
          assinatura_status: string
          ca_numero: string | null
          company_id: string | null
          created_at: string
          data_devolucao: string | null
          data_entrega: string
          data_validade: string | null
          documento_assinado_url: string | null
          employee_id: string
          entregue_por: string | null
          epi_catalog_id: string
          external_document_id: string | null
          hash_documento: string | null
          id: string
          lot_id: string | null
          lote: string | null
          metadata: Json | null
          motivo: string
          motivo_devolucao: string | null
          observacoes: string | null
          quantidade: number
          risk_exposure_id: string | null
          signature_provider: string | null
          status: string
          storage_path: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assinatura_status?: string
          ca_numero?: string | null
          company_id?: string | null
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string
          data_validade?: string | null
          documento_assinado_url?: string | null
          employee_id: string
          entregue_por?: string | null
          epi_catalog_id: string
          external_document_id?: string | null
          hash_documento?: string | null
          id?: string
          lot_id?: string | null
          lote?: string | null
          metadata?: Json | null
          motivo?: string
          motivo_devolucao?: string | null
          observacoes?: string | null
          quantidade?: number
          risk_exposure_id?: string | null
          signature_provider?: string | null
          status?: string
          storage_path?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assinatura_status?: string
          ca_numero?: string | null
          company_id?: string | null
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string
          data_validade?: string | null
          documento_assinado_url?: string | null
          employee_id?: string
          entregue_por?: string | null
          epi_catalog_id?: string
          external_document_id?: string | null
          hash_documento?: string | null
          id?: string
          lot_id?: string | null
          lote?: string | null
          metadata?: Json | null
          motivo?: string
          motivo_devolucao?: string | null
          observacoes?: string | null
          quantidade?: number
          risk_exposure_id?: string | null
          signature_provider?: string | null
          status?: string
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "epi_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_risk_exposure_id_fkey"
            columns: ["risk_exposure_id"]
            isOneToOne: false
            referencedRelation: "employee_risk_exposures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_employee_costs: {
        Row: {
          centro_custo: string | null
          company_id: string | null
          created_at: string
          custo_total: number
          custo_unitario: number
          data_apropriacao: string
          delivery_id: string | null
          employee_id: string
          epi_catalog_id: string
          id: string
          impacto_financeiro: number | null
          lot_id: string | null
          metadata: Json | null
          quantidade: number
          tenant_id: string
        }
        Insert: {
          centro_custo?: string | null
          company_id?: string | null
          created_at?: string
          custo_total?: number
          custo_unitario?: number
          data_apropriacao?: string
          delivery_id?: string | null
          employee_id: string
          epi_catalog_id: string
          id?: string
          impacto_financeiro?: number | null
          lot_id?: string | null
          metadata?: Json | null
          quantidade?: number
          tenant_id: string
        }
        Update: {
          centro_custo?: string | null
          company_id?: string | null
          created_at?: string
          custo_total?: number
          custo_unitario?: number
          data_apropriacao?: string
          delivery_id?: string | null
          employee_id?: string
          epi_catalog_id?: string
          id?: string
          impacto_financeiro?: number | null
          lot_id?: string | null
          metadata?: Json | null
          quantidade?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_employee_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_employee_costs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_employee_costs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_employee_costs_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_employee_costs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "epi_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_employee_costs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_incidents: {
        Row: {
          created_at: string
          data: string
          delivery_id: string | null
          employee_id: string
          epi_catalog_id: string
          id: string
          justificativa: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          safety_signal_id: string | null
          severity: string
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          delivery_id?: string | null
          employee_id: string
          epi_catalog_id: string
          id?: string
          justificativa: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          safety_signal_id?: string | null
          severity?: string
          status?: string
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          delivery_id?: string | null
          employee_id?: string
          epi_catalog_id?: string
          id?: string
          justificativa?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          safety_signal_id?: string | null
          severity?: string
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_inventory: {
        Row: {
          created_at: string
          custo_unitario_medio: number
          epi_catalog_id: string
          id: string
          last_movement_at: string | null
          local_estoque: string | null
          lot_id: string | null
          metadata: Json | null
          quantidade_disponivel: number
          quantidade_minima: number
          quantidade_reservada: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          custo_unitario_medio?: number
          epi_catalog_id: string
          id?: string
          last_movement_at?: string | null
          local_estoque?: string | null
          lot_id?: string | null
          metadata?: Json | null
          quantidade_disponivel?: number
          quantidade_minima?: number
          quantidade_reservada?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          custo_unitario_medio?: number
          epi_catalog_id?: string
          id?: string
          last_movement_at?: string | null
          local_estoque?: string | null
          lot_id?: string | null
          metadata?: Json | null
          quantidade_disponivel?: number
          quantidade_minima?: number
          quantidade_reservada?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_inventory_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "epi_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "epi_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_inventory_audit_log: {
        Row: {
          action: string
          created_at: string
          diferenca: number | null
          epi_catalog_id: string | null
          id: string
          inventory_id: string | null
          ip_address: string | null
          lot_id: string | null
          metadata: Json | null
          motivo: string | null
          quantidade_antes: number
          quantidade_depois: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          usuario_email: string | null
          usuario_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diferenca?: number | null
          epi_catalog_id?: string | null
          id?: string
          inventory_id?: string | null
          ip_address?: string | null
          lot_id?: string | null
          metadata?: Json | null
          motivo?: string | null
          quantidade_antes?: number
          quantidade_depois?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          usuario_email?: string | null
          usuario_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diferenca?: number | null
          epi_catalog_id?: string | null
          id?: string
          inventory_id?: string | null
          ip_address?: string | null
          lot_id?: string | null
          metadata?: Json | null
          motivo?: string | null
          quantidade_antes?: number
          quantidade_depois?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          usuario_email?: string | null
          usuario_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_inventory_audit_log_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_audit_log_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "epi_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_audit_log_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "epi_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_audit_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "epi_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_inventory_movements: {
        Row: {
          created_at: string
          custo_total: number | null
          custo_unitario: number | null
          delivery_id: string | null
          employee_id: string | null
          epi_catalog_id: string
          executor_user_id: string | null
          id: string
          inventory_id: string
          justificativa: string | null
          lot_id: string | null
          metadata: Json | null
          movement_type: string
          nota_fiscal: string | null
          quantidade: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          custo_total?: number | null
          custo_unitario?: number | null
          delivery_id?: string | null
          employee_id?: string | null
          epi_catalog_id: string
          executor_user_id?: string | null
          id?: string
          inventory_id: string
          justificativa?: string | null
          lot_id?: string | null
          metadata?: Json | null
          movement_type: string
          nota_fiscal?: string | null
          quantidade: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          custo_total?: number | null
          custo_unitario?: number | null
          delivery_id?: string | null
          employee_id?: string | null
          epi_catalog_id?: string
          executor_user_id?: string | null
          id?: string
          inventory_id?: string
          justificativa?: string | null
          lot_id?: string | null
          metadata?: Json | null
          movement_type?: string
          nota_fiscal?: string | null
          quantidade?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_inventory_movements_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_movements_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "epi_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "epi_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "epi_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_lots: {
        Row: {
          ca_numero: string | null
          ca_validade: string | null
          created_at: string
          custo_unitario: number
          epi_catalog_id: string
          fabricante: string | null
          fornecedor: string | null
          id: string
          lote_fabricacao: string | null
          lote_numero: string
          lote_validade: string | null
          metadata: Json | null
          nota_fiscal: string | null
          nota_fiscal_data: string | null
          quantidade_recebida: number
          serial_number: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ca_numero?: string | null
          ca_validade?: string | null
          created_at?: string
          custo_unitario?: number
          epi_catalog_id: string
          fabricante?: string | null
          fornecedor?: string | null
          id?: string
          lote_fabricacao?: string | null
          lote_numero: string
          lote_validade?: string | null
          metadata?: Json | null
          nota_fiscal?: string | null
          nota_fiscal_data?: string | null
          quantidade_recebida?: number
          serial_number?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ca_numero?: string | null
          ca_validade?: string | null
          created_at?: string
          custo_unitario?: number
          epi_catalog_id?: string
          fabricante?: string | null
          fornecedor?: string | null
          id?: string
          lote_fabricacao?: string | null
          lote_numero?: string
          lote_validade?: string | null
          metadata?: Json | null
          nota_fiscal?: string | null
          nota_fiscal_data?: string | null
          quantidade_recebida?: number
          serial_number?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_lots_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_lots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_requirements: {
        Row: {
          atendido_em: string | null
          atendido_por: string | null
          created_at: string
          delivery_id: string | null
          employee_id: string
          epi_catalog_id: string
          id: string
          motivo: string
          obrigatorio: boolean
          risk_exposure_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          atendido_em?: string | null
          atendido_por?: string | null
          created_at?: string
          delivery_id?: string | null
          employee_id: string
          epi_catalog_id: string
          id?: string
          motivo: string
          obrigatorio?: boolean
          risk_exposure_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          atendido_em?: string | null
          atendido_por?: string | null
          created_at?: string
          delivery_id?: string | null
          employee_id?: string
          epi_catalog_id?: string
          id?: string
          motivo?: string
          obrigatorio?: boolean
          risk_exposure_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_requirements_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_requirements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_requirements_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_requirements_risk_exposure_id_fkey"
            columns: ["risk_exposure_id"]
            isOneToOne: false
            referencedRelation: "employee_risk_exposures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_risk_mappings: {
        Row: {
          created_at: string
          descricao: string | null
          epi_catalog_id: string
          id: string
          nr_aplicavel: number | null
          obrigatorio: boolean | null
          risk_agent: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          epi_catalog_id: string
          id?: string
          nr_aplicavel?: number | null
          obrigatorio?: boolean | null
          risk_agent: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          epi_catalog_id?: string
          id?: string
          nr_aplicavel?: number | null
          obrigatorio?: boolean | null
          risk_agent?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_risk_mappings_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_risk_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_signatures: {
        Row: {
          assinado_em: string
          assinatura_data: Json | null
          assinatura_hash: string | null
          created_at: string
          delivery_id: string
          documento_url: string | null
          employee_id: string
          id: string
          invalidado_em: string | null
          invalidado_por: string | null
          ip_address: string | null
          is_valid: boolean | null
          metadata: Json | null
          motivo_invalidacao: string | null
          tenant_id: string
          termo_aceite: string
          tipo_assinatura: string
          user_agent: string | null
        }
        Insert: {
          assinado_em?: string
          assinatura_data?: Json | null
          assinatura_hash?: string | null
          created_at?: string
          delivery_id: string
          documento_url?: string | null
          employee_id: string
          id?: string
          invalidado_em?: string | null
          invalidado_por?: string | null
          ip_address?: string | null
          is_valid?: boolean | null
          metadata?: Json | null
          motivo_invalidacao?: string | null
          tenant_id: string
          termo_aceite?: string
          tipo_assinatura?: string
          user_agent?: string | null
        }
        Update: {
          assinado_em?: string
          assinatura_data?: Json | null
          assinatura_hash?: string | null
          created_at?: string
          delivery_id?: string
          documento_url?: string | null
          employee_id?: string
          id?: string
          invalidado_em?: string | null
          invalidado_por?: string | null
          ip_address?: string | null
          is_valid?: boolean | null
          metadata?: Json | null
          motivo_invalidacao?: string | null
          tenant_id?: string
          termo_aceite?: string
          tipo_assinatura?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_signatures_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "epi_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_signatures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_stock_alerts: {
        Row: {
          alert_type: string
          created_at: string
          epi_catalog_id: string
          id: string
          inventory_id: string
          is_resolved: boolean
          quantidade_disponivel: number
          quantidade_minima: number
          resolved_at: string | null
          resolved_by: string | null
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          epi_catalog_id: string
          id?: string
          inventory_id: string
          is_resolved?: boolean
          quantidade_disponivel: number
          quantidade_minima: number
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          epi_catalog_id?: string
          id?: string
          inventory_id?: string
          is_resolved?: boolean
          quantidade_disponivel?: number
          quantidade_minima?: number
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_stock_alerts_epi_catalog_id_fkey"
            columns: ["epi_catalog_id"]
            isOneToOne: false
            referencedRelation: "epi_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_stock_alerts_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "epi_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_stock_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_stock_alerts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "epi_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_warehouses: {
        Row: {
          address: string | null
          code: string
          company_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          responsible_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          responsible_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          responsible_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_event_mappings: {
        Row: {
          auto_generate: boolean
          category: Database["public"]["Enums"]["esocial_event_category"]
          created_at: string
          description: string | null
          esocial_event_type: string
          id: string
          is_active: boolean
          payload_template: Json | null
          tenant_id: string
          trigger_action: string
          trigger_conditions: Json | null
          trigger_table: string
          updated_at: string
        }
        Insert: {
          auto_generate?: boolean
          category: Database["public"]["Enums"]["esocial_event_category"]
          created_at?: string
          description?: string | null
          esocial_event_type: string
          id?: string
          is_active?: boolean
          payload_template?: Json | null
          tenant_id: string
          trigger_action: string
          trigger_conditions?: Json | null
          trigger_table: string
          updated_at?: string
        }
        Update: {
          auto_generate?: boolean
          category?: Database["public"]["Enums"]["esocial_event_category"]
          created_at?: string
          description?: string | null
          esocial_event_type?: string
          id?: string
          is_active?: boolean
          payload_template?: Json | null
          tenant_id?: string
          trigger_action?: string
          trigger_conditions?: Json | null
          trigger_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esocial_event_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_events: {
        Row: {
          category: Database["public"]["Enums"]["esocial_event_category"]
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          receipt_number: string | null
          reference_period: string | null
          response_payload: Json | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["esocial_event_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["esocial_event_category"]
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          receipt_number?: string | null
          reference_period?: string | null
          response_payload?: Json | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["esocial_event_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["esocial_event_category"]
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          receipt_number?: string | null
          reference_period?: string | null
          response_payload?: Json | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["esocial_event_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esocial_events_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_governance_logs: {
        Row: {
          acao: string
          created_at: string
          empresa_id: string | null
          evento: string | null
          id: string
          metadata: Json | null
          status: string
          tenant_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          empresa_id?: string | null
          evento?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          tenant_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          empresa_id?: string | null
          evento?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esocial_governance_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_governance_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_profiles: {
        Row: {
          available_widgets: string[]
          branding: Json | null
          cognitive_context_level: string
          cognitive_hints_enabled: boolean
          created_at: string
          default_dashboard_layout: Json
          hidden_navigation: string[]
          id: string
          locked_navigation: Json
          plan_id: string
          resolved_at: string
          tenant_id: string
          ui_features: Json
          updated_at: string
          visible_navigation: string[]
        }
        Insert: {
          available_widgets?: string[]
          branding?: Json | null
          cognitive_context_level?: string
          cognitive_hints_enabled?: boolean
          created_at?: string
          default_dashboard_layout?: Json
          hidden_navigation?: string[]
          id?: string
          locked_navigation?: Json
          plan_id: string
          resolved_at?: string
          tenant_id: string
          ui_features?: Json
          updated_at?: string
          visible_navigation?: string[]
        }
        Update: {
          available_widgets?: string[]
          branding?: Json | null
          cognitive_context_level?: string
          cognitive_hints_enabled?: boolean
          created_at?: string
          default_dashboard_layout?: Json
          hidden_navigation?: string[]
          id?: string
          locked_navigation?: Json
          plan_id?: string
          resolved_at?: string
          tenant_id?: string
          ui_features?: Json
          updated_at?: string
          visible_navigation?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "experience_profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exposure_group_risks: {
        Row: {
          control_measures: string | null
          created_at: string
          epi_ca_number: string | null
          epi_description: string | null
          exposure_group_id: string
          id: string
          intensity: string | null
          measurement_date: string | null
          requires_epi: boolean
          risk_factor_id: string
        }
        Insert: {
          control_measures?: string | null
          created_at?: string
          epi_ca_number?: string | null
          epi_description?: string | null
          exposure_group_id: string
          id?: string
          intensity?: string | null
          measurement_date?: string | null
          requires_epi?: boolean
          risk_factor_id: string
        }
        Update: {
          control_measures?: string | null
          created_at?: string
          epi_ca_number?: string | null
          epi_description?: string | null
          exposure_group_id?: string
          id?: string
          intensity?: string | null
          measurement_date?: string | null
          requires_epi?: boolean
          risk_factor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exposure_group_risks_exposure_group_id_fkey"
            columns: ["exposure_group_id"]
            isOneToOne: false
            referencedRelation: "exposure_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exposure_group_risks_risk_factor_id_fkey"
            columns: ["risk_factor_id"]
            isOneToOne: false
            referencedRelation: "occupational_risk_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      exposure_groups: {
        Row: {
          cbo_code: string | null
          code: string
          company_group_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          environment: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cbo_code?: string | null
          code: string
          company_group_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cbo_code?: string | null
          code?: string
          company_group_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exposure_groups_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exposure_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exposure_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_changes: {
        Row: {
          author: string
          change_type: string
          created_at: string
          feature_key: string
          id: string
          module_key: string | null
          new_state: Json
          previous_state: Json | null
          version_id: string | null
        }
        Insert: {
          author: string
          change_type: string
          created_at?: string
          feature_key: string
          id?: string
          module_key?: string | null
          new_state?: Json
          previous_state?: Json | null
          version_id?: string | null
        }
        Update: {
          author?: string
          change_type?: string
          created_at?: string
          feature_key?: string
          id?: string
          module_key?: string | null
          new_state?: Json
          previous_state?: Json | null
          version_id?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          company_group_id: string | null
          company_id: string | null
          created_at: string
          enabled: boolean
          feature_name: string
          id: string
          metadata: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          enabled?: boolean
          feature_name: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          enabled?: boolean
          feature_name?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          integrity_hash: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          integrity_hash: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          integrity_hash?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_behavior_events: {
        Row: {
          company_id: string | null
          created_at: string
          details: Json
          device_id: string
          employee_id: string | null
          event_timestamp: string
          event_type: string
          id: string
          severity: string
          source_event_id: string | null
          tenant_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          details?: Json
          device_id: string
          employee_id?: string | null
          event_timestamp: string
          event_type: string
          id?: string
          severity: string
          source_event_id?: string | null
          tenant_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          details?: Json
          device_id?: string
          employee_id?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          severity?: string
          source_event_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_behavior_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_behavior_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_behavior_events_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "raw_tracking_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_behavior_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_compliance_incidents: {
        Row: {
          behavior_event_id: string | null
          company_id: string | null
          created_at: string
          device_id: string
          employee_id: string | null
          evidence: Json
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          tenant_id: string
          updated_at: string
          violation_type: string
        }
        Insert: {
          behavior_event_id?: string | null
          company_id?: string | null
          created_at?: string
          device_id: string
          employee_id?: string | null
          evidence?: Json
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
          status?: string
          tenant_id: string
          updated_at?: string
          violation_type: string
        }
        Update: {
          behavior_event_id?: string | null
          company_id?: string | null
          created_at?: string
          device_id?: string
          employee_id?: string | null
          evidence?: Json
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_compliance_incidents_behavior_event_id_fkey"
            columns: ["behavior_event_id"]
            isOneToOne: false
            referencedRelation: "fleet_behavior_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_compliance_incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_compliance_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_compliance_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_devices: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          device_type: string
          employee_id: string | null
          id: string
          is_active: boolean
          model: string | null
          plate: string | null
          serial_number: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          device_type: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          plate?: string | null
          serial_number: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          device_type?: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          model?: string | null
          plate?: string | null
          serial_number?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_devices_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_disciplinary_history: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          event_type: string
          id: string
          incident_id: string | null
          metadata: Json | null
          tenant_id: string
          warning_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          employee_id: string
          event_type: string
          id?: string
          incident_id?: string | null
          metadata?: Json | null
          tenant_id: string
          warning_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          event_type?: string
          id?: string
          incident_id?: string | null
          metadata?: Json | null
          tenant_id?: string
          warning_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_disciplinary_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_disciplinary_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "fleet_compliance_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_disciplinary_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_disciplinary_history_warning_id_fkey"
            columns: ["warning_id"]
            isOneToOne: false
            referencedRelation: "fleet_warnings"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_driving_rules: {
        Row: {
          allowed_hours_end: string
          allowed_hours_start: string
          company_id: string
          created_at: string
          geofence_polygon: Json | null
          id: string
          is_active: boolean
          planned_route: Json | null
          speed_limit_kmh: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allowed_hours_end?: string
          allowed_hours_start?: string
          company_id: string
          created_at?: string
          geofence_polygon?: Json | null
          id?: string
          is_active?: boolean
          planned_route?: Json | null
          speed_limit_kmh?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allowed_hours_end?: string
          allowed_hours_start?: string
          company_id?: string
          created_at?: string
          geofence_polygon?: Json | null
          id?: string
          is_active?: boolean
          planned_route?: Json | null
          speed_limit_kmh?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_driving_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_driving_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_employee_agreement_status: {
        Row: {
          agreement_type: string
          created_at: string
          document_url: string | null
          employee_id: string
          expires_at: string | null
          id: string
          required_agreement_id: string
          signed_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agreement_type: string
          created_at?: string
          document_url?: string | null
          employee_id: string
          expires_at?: string | null
          id?: string
          required_agreement_id: string
          signed_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agreement_type?: string
          created_at?: string
          document_url?: string | null
          employee_id?: string
          expires_at?: string | null
          id?: string
          required_agreement_id?: string
          signed_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_employee_agreement_status_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_employee_agreement_status_required_agreement_id_fkey"
            columns: ["required_agreement_id"]
            isOneToOne: false
            referencedRelation: "fleet_required_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_employee_agreement_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_enforcement_points: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string | null
          radius_meters: number
          speed_limit_kmh: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name?: string | null
          radius_meters?: number
          speed_limit_kmh: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string | null
          radius_meters?: number
          speed_limit_kmh?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_enforcement_points_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_enforcement_points_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_provider_configs: {
        Row: {
          api_token: string
          api_url: string
          created_at: string
          id: string
          is_active: boolean
          provider_name: string
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_token: string
          api_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider_name?: string
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string
          api_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider_name?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_provider_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_required_agreements: {
        Row: {
          agreement_template_id: string
          agreement_type: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          is_blocking: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agreement_template_id: string
          agreement_type: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agreement_template_id?: string
          agreement_type?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_required_agreements_agreement_template_id_fkey"
            columns: ["agreement_template_id"]
            isOneToOne: false
            referencedRelation: "agreement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_required_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_required_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_warnings: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          document_url: string | null
          employee_id: string
          id: string
          incident_id: string
          issued_at: string
          issued_by: string | null
          signature_request_id: string | null
          signature_status: string
          signed_at: string | null
          tenant_id: string
          updated_at: string
          warning_type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          document_url?: string | null
          employee_id: string
          id?: string
          incident_id: string
          issued_at?: string
          issued_by?: string | null
          signature_request_id?: string | null
          signature_status?: string
          signed_at?: string | null
          tenant_id: string
          updated_at?: string
          warning_type?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          document_url?: string | null
          employee_id?: string
          id?: string
          incident_id?: string
          issued_at?: string
          issued_by?: string | null
          signature_request_id?: string | null
          signature_status?: string
          signed_at?: string | null
          tenant_id?: string
          updated_at?: string
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_warnings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_warnings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_warnings_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "fleet_compliance_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_warnings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_leaderboard: {
        Row: {
          current_tier: string
          total_conversions: number
          total_points: number
          total_referrals: number
          total_reward_brl: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_tier?: string
          total_conversions?: number
          total_points?: number
          total_referrals?: number
          total_reward_brl?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_tier?: string
          total_conversions?: number
          total_points?: number
          total_referrals?: number
          total_reward_brl?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gamification_levels: {
        Row: {
          badge_label: string | null
          color: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          min_points: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          badge_label?: string | null
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          min_points?: number
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          badge_label?: string | null
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          min_points?: number
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gamification_point_weights: {
        Row: {
          action_key: string
          action_label: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          points: number
          updated_at: string
        }
        Insert: {
          action_key: string
          action_label: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          points?: number
          updated_at?: string
        }
        Update: {
          action_key?: string
          action_label?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      gamification_points: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          points: number
          source: string
          source_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          source?: string
          source_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          source?: string
          source_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gamification_profiles: {
        Row: {
          badges: string[]
          created_at: string
          id: string
          last_activity_at: string | null
          level_id: string | null
          streak_months: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          badges?: string[]
          created_at?: string
          id?: string
          last_activity_at?: string | null
          level_id?: string | null
          streak_months?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          badges?: string[]
          created_at?: string
          id?: string
          last_activity_at?: string | null
          level_id?: string | null
          streak_months?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "gamification_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_audit_snapshots: {
        Row: {
          anomalies: Json
          composition_time_ms: number | null
          created_at: string
          created_by: string | null
          edge_count: number
          excessive_permissions: Json
          id: string
          node_count: number
          orphan_nodes: Json
          permission_count: number
          risk_level: string
          risk_signals: Json
          role_count: number
          role_overlaps: Json
          snapshot_type: string
          tenant_id: string
          user_count: number
        }
        Insert: {
          anomalies?: Json
          composition_time_ms?: number | null
          created_at?: string
          created_by?: string | null
          edge_count?: number
          excessive_permissions?: Json
          id?: string
          node_count?: number
          orphan_nodes?: Json
          permission_count?: number
          risk_level?: string
          risk_signals?: Json
          role_count?: number
          role_overlaps?: Json
          snapshot_type?: string
          tenant_id: string
          user_count?: number
        }
        Update: {
          anomalies?: Json
          composition_time_ms?: number | null
          created_at?: string
          created_by?: string | null
          edge_count?: number
          excessive_permissions?: Json
          id?: string
          node_count?: number
          orphan_nodes?: Json
          permission_count?: number
          risk_level?: string
          risk_signals?: Json
          role_count?: number
          role_overlaps?: Json
          snapshot_type?: string
          tenant_id?: string
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "governance_audit_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_submission_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          notes: string | null
          performed_by: string
          performed_by_email: string
          submission_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by: string
          performed_by_email: string
          submission_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by?: string
          performed_by_email?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_submission_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "growth_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_submissions: {
        Row: {
          change_summary: string | null
          content_id: string
          content_snapshot: Json
          content_title: string
          content_type: string
          created_at: string
          diff_from_previous: Json | null
          id: string
          publish_approved_at: string | null
          publish_approved_by: string | null
          published_at: string | null
          published_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_email: string | null
          status: string
          submitted_at: string
          submitted_by: string
          submitted_by_email: string
          updated_at: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          content_id: string
          content_snapshot: Json
          content_title: string
          content_type: string
          created_at?: string
          diff_from_previous?: Json | null
          id?: string
          publish_approved_at?: string | null
          publish_approved_by?: string | null
          published_at?: string | null
          published_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          submitted_by_email: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          content_id?: string
          content_snapshot?: Json
          content_title?: string
          content_type?: string
          created_at?: string
          diff_from_previous?: Json | null
          id?: string
          publish_approved_at?: string | null
          publish_approved_by?: string | null
          published_at?: string | null
          published_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          submitted_by_email?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: []
      }
      health_programs: {
        Row: {
          company_group_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          document_url: string | null
          exam_periodicity_months: number
          generates_hazard_pay: boolean
          hazard_pay_type: string | null
          id: string
          name: string
          notes: string | null
          program_type: Database["public"]["Enums"]["health_program_type"]
          responsible_name: string | null
          responsible_registration: string | null
          status: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          company_group_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          document_url?: string | null
          exam_periodicity_months?: number
          generates_hazard_pay?: boolean
          hazard_pay_type?: string | null
          id?: string
          name: string
          notes?: string | null
          program_type: Database["public"]["Enums"]["health_program_type"]
          responsible_name?: string | null
          responsible_registration?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until: string
        }
        Update: {
          company_group_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          document_url?: string | null
          exam_periodicity_months?: number
          generates_hazard_pay?: boolean
          hazard_pay_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          program_type?: Database["public"]["Enums"]["health_program_type"]
          responsible_name?: string | null
          responsible_registration?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_programs_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_programs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hiring_processes: {
        Row: {
          cancellation_reason: string | null
          candidate_cpf: string
          candidate_name: string
          company_id: string
          created_at: string
          created_by: string | null
          current_step: string
          data_conclusao: string | null
          data_inicio: string
          employee_id: string | null
          id: string
          status: string
          steps: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          candidate_cpf: string
          candidate_name: string
          company_id: string
          created_at?: string
          created_by?: string | null
          current_step?: string
          data_conclusao?: string | null
          data_inicio?: string
          employee_id?: string | null
          id?: string
          status?: string
          steps?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          candidate_cpf?: string
          candidate_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_step?: string
          data_conclusao?: string | null
          data_inicio?: string
          employee_id?: string | null
          id?: string
          status?: string
          steps?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hiring_processes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_processes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_processes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          operation_count: number
          platform_user_id: string
          reason: string
          simulated_role: string
          started_at: string
          status: string
          target_user_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          operation_count?: number
          platform_user_id: string
          reason: string
          simulated_role?: string
          started_at?: string
          status?: string
          target_user_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          operation_count?: number
          platform_user_id?: string
          reason?: string
          simulated_role?: string
          started_at?: string
          status?: string
          target_user_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connector_configs: {
        Row: {
          connector_id: string
          created_at: string
          created_by: string | null
          credentials_encrypted: Json
          display_name: string
          id: string
          last_tested_at: string | null
          settings: Json
          status: string
          tenant_id: string
          test_result: string | null
          updated_at: string
        }
        Insert: {
          connector_id: string
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: Json
          display_name: string
          id?: string
          last_tested_at?: string | null
          settings?: Json
          status?: string
          tenant_id: string
          test_result?: string | null
          updated_at?: string
        }
        Update: {
          connector_id?: string
          created_at?: string
          created_by?: string | null
          credentials_encrypted?: Json
          display_name?: string
          id?: string
          last_tested_at?: string | null
          settings?: Json
          status?: string
          tenant_id?: string
          test_result?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connector_configs_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connector_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connectors: {
        Row: {
          auth_config: Json
          auth_type: string
          available_actions: Json
          available_triggers: Json
          base_url: string | null
          connector_type: string
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          auth_config?: Json
          auth_type?: string
          available_actions?: Json
          available_triggers?: Json
          base_url?: string | null
          connector_type?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          auth_config?: Json
          auth_type?: string
          available_actions?: Json
          available_triggers?: Json
          base_url?: string | null
          connector_type?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_execution_node_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          execution_id: string
          id: string
          input_data: Json | null
          node_id: string
          output_data: Json | null
          retry_attempt: number
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_id: string
          id?: string
          input_data?: Json | null
          node_id: string
          output_data?: Json | null
          retry_attempt?: number
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_id?: string
          id?: string
          input_data?: Json | null
          node_id?: string
          output_data?: Json | null
          retry_attempt?: number
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_execution_node_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "integration_workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_execution_node_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_workflow_edges: {
        Row: {
          condition_expression: string | null
          created_at: string
          edge_type: string
          id: string
          label: string | null
          sort_order: number
          source_node_id: string
          target_node_id: string
          tenant_id: string
          workflow_id: string
        }
        Insert: {
          condition_expression?: string | null
          created_at?: string
          edge_type?: string
          id?: string
          label?: string | null
          sort_order?: number
          source_node_id: string
          target_node_id: string
          tenant_id: string
          workflow_id: string
        }
        Update: {
          condition_expression?: string | null
          created_at?: string
          edge_type?: string
          id?: string
          label?: string | null
          sort_order?: number
          source_node_id?: string
          target_node_id?: string
          tenant_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_workflow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "integration_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "integration_workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_edges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_edges_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "integration_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_workflow_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          error_node_id: string | null
          id: string
          initiated_by: string | null
          is_sandbox: boolean
          node_results: Json
          retries_used: number
          started_at: string | null
          status: string
          tenant_id: string
          trigger_payload: Json | null
          trigger_type: string
          version_number: number
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          error_node_id?: string | null
          id?: string
          initiated_by?: string | null
          is_sandbox?: boolean
          node_results?: Json
          retries_used?: number
          started_at?: string | null
          status?: string
          tenant_id: string
          trigger_payload?: Json | null
          trigger_type: string
          version_number: number
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          error_node_id?: string | null
          id?: string
          initiated_by?: string | null
          is_sandbox?: boolean
          node_results?: Json
          retries_used?: number
          started_at?: string | null
          status?: string
          tenant_id?: string
          trigger_payload?: Json | null
          trigger_type?: string
          version_number?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_workflow_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "integration_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_workflow_nodes: {
        Row: {
          action_key: string | null
          connector_config_id: string | null
          connector_id: string | null
          created_at: string
          description: string | null
          id: string
          input_config: Json
          is_enabled: boolean
          label: string
          node_type: string
          output_mapping: Json
          position_x: number
          position_y: number
          retry_config: Json
          sort_order: number
          tenant_id: string
          timeout_ms: number
          updated_at: string
          workflow_id: string
        }
        Insert: {
          action_key?: string | null
          connector_config_id?: string | null
          connector_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          input_config?: Json
          is_enabled?: boolean
          label: string
          node_type: string
          output_mapping?: Json
          position_x?: number
          position_y?: number
          retry_config?: Json
          sort_order?: number
          tenant_id: string
          timeout_ms?: number
          updated_at?: string
          workflow_id: string
        }
        Update: {
          action_key?: string | null
          connector_config_id?: string | null
          connector_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          input_config?: Json
          is_enabled?: boolean
          label?: string
          node_type?: string
          output_mapping?: Json
          position_x?: number
          position_y?: number
          retry_config?: Json
          sort_order?: number
          tenant_id?: string
          timeout_ms?: number
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_workflow_nodes_connector_config_id_fkey"
            columns: ["connector_config_id"]
            isOneToOne: false
            referencedRelation: "integration_connector_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_nodes_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_nodes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_nodes_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "integration_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_workflow_usage: {
        Row: {
          api_calls_external: number
          created_at: string
          data_transferred_bytes: number
          failed_executions: number
          id: string
          period_start: string
          period_type: string
          successful_executions: number
          tenant_id: string
          total_duration_ms: number
          total_executions: number
          total_node_runs: number
          updated_at: string
        }
        Insert: {
          api_calls_external?: number
          created_at?: string
          data_transferred_bytes?: number
          failed_executions?: number
          id?: string
          period_start: string
          period_type?: string
          successful_executions?: number
          tenant_id: string
          total_duration_ms?: number
          total_executions?: number
          total_node_runs?: number
          updated_at?: string
        }
        Update: {
          api_calls_external?: number
          created_at?: string
          data_transferred_bytes?: number
          failed_executions?: number
          id?: string
          period_start?: string
          period_type?: string
          successful_executions?: number
          tenant_id?: string
          total_duration_ms?: number
          total_executions?: number
          total_node_runs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_workflow_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_workflow_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          edges: Json
          id: string
          is_current: boolean
          nodes: Json
          published_at: string | null
          published_by: string | null
          tenant_id: string
          version_number: number
          version_tag: string | null
          workflow_id: string
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          edges?: Json
          id?: string
          is_current?: boolean
          nodes?: Json
          published_at?: string | null
          published_by?: string | null
          tenant_id: string
          version_number: number
          version_tag?: string | null
          workflow_id: string
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          edges?: Json
          id?: string
          is_current?: boolean
          nodes?: Json
          published_at?: string | null
          published_by?: string | null
          tenant_id?: string
          version_number?: number
          version_tag?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_workflow_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "integration_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_workflows: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          current_version: number
          description: string | null
          error_count: number
          execution_count: number
          id: string
          is_template: boolean
          last_executed_at: string | null
          last_execution_result: string | null
          name: string
          settings: Json
          status: string
          tenant_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          error_count?: number
          execution_count?: number
          id?: string
          is_template?: boolean
          last_executed_at?: string | null
          last_execution_result?: string | null
          name: string
          settings?: Json
          status?: string
          tenant_id: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          error_count?: number
          execution_count?: number
          id?: string
          is_template?: boolean
          last_executed_at?: string | null
          last_execution_result?: string | null
          name?: string
          settings?: Json
          status?: string
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string
          currency: string
          due_date: string
          id: string
          metadata: Json | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          plan_id: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_id?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_id?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_rule_definitions: {
        Row: {
          aplica_reflexos: boolean
          base_calculo: string | null
          base_percentage: number | null
          calc_type: Database["public"]["Enums"]["labor_rule_calc_type"]
          category: Database["public"]["Enums"]["labor_rule_category"]
          clt_article: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          effective_from: string
          effective_until: string | null
          esocial_rubric_code: string | null
          fixed_value: number | null
          formula_expression: string | null
          id: string
          integra_13: boolean
          integra_dsr: boolean
          integra_ferias: boolean
          integra_fgts: boolean
          integra_inss: boolean
          integra_irrf: boolean
          integra_salario: boolean
          is_active: boolean
          is_mandatory: boolean
          legal_basis: string | null
          limite_horas: number | null
          name: string
          oncall_tipo: string | null
          percentual_sobre_hora: number | null
          priority: number
          rule_set_id: string
          tenant_id: string
          tiered_config: Json | null
          updated_at: string
        }
        Insert: {
          aplica_reflexos?: boolean
          base_calculo?: string | null
          base_percentage?: number | null
          calc_type?: Database["public"]["Enums"]["labor_rule_calc_type"]
          category: Database["public"]["Enums"]["labor_rule_category"]
          clt_article?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          esocial_rubric_code?: string | null
          fixed_value?: number | null
          formula_expression?: string | null
          id?: string
          integra_13?: boolean
          integra_dsr?: boolean
          integra_ferias?: boolean
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          integra_salario?: boolean
          is_active?: boolean
          is_mandatory?: boolean
          legal_basis?: string | null
          limite_horas?: number | null
          name: string
          oncall_tipo?: string | null
          percentual_sobre_hora?: number | null
          priority?: number
          rule_set_id: string
          tenant_id: string
          tiered_config?: Json | null
          updated_at?: string
        }
        Update: {
          aplica_reflexos?: boolean
          base_calculo?: string | null
          base_percentage?: number | null
          calc_type?: Database["public"]["Enums"]["labor_rule_calc_type"]
          category?: Database["public"]["Enums"]["labor_rule_category"]
          clt_article?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          esocial_rubric_code?: string | null
          fixed_value?: number | null
          formula_expression?: string | null
          id?: string
          integra_13?: boolean
          integra_dsr?: boolean
          integra_ferias?: boolean
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          integra_salario?: boolean
          is_active?: boolean
          is_mandatory?: boolean
          legal_basis?: string | null
          limite_horas?: number | null
          name?: string
          oncall_tipo?: string | null
          percentual_sobre_hora?: number | null
          priority?: number
          rule_set_id?: string
          tenant_id?: string
          tiered_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_rule_definitions_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "labor_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_rule_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_rule_sets: {
        Row: {
          base_monthly_hours: number
          categoria_profissional: string | null
          cct_number: string | null
          cct_valid_from: string | null
          cct_valid_until: string | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          uf: string | null
          union_code: string | null
          union_name: string | null
          updated_at: string
        }
        Insert: {
          base_monthly_hours?: number
          categoria_profissional?: string | null
          cct_number?: string | null
          cct_valid_from?: string | null
          cct_valid_until?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          uf?: string | null
          union_code?: string | null
          union_name?: string | null
          updated_at?: string
        }
        Update: {
          base_monthly_hours?: number
          categoria_profissional?: string | null
          cct_number?: string | null
          cct_valid_from?: string | null
          cct_valid_until?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          uf?: string | null
          union_code?: string | null
          union_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_rule_sets_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_rule_sets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_rule_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_deployments: {
        Row: {
          cloudflare_record_id: string | null
          created_at: string
          deployed_at: string | null
          deployed_by: string | null
          error_message: string | null
          full_url: string
          id: string
          landing_page_id: string
          removed_at: string | null
          status: string
          subdomain: string
        }
        Insert: {
          cloudflare_record_id?: string | null
          created_at?: string
          deployed_at?: string | null
          deployed_by?: string | null
          error_message?: string | null
          full_url: string
          id?: string
          landing_page_id: string
          removed_at?: string | null
          status?: string
          subdomain: string
        }
        Update: {
          cloudflare_record_id?: string | null
          created_at?: string
          deployed_at?: string | null
          deployed_by?: string | null
          error_message?: string | null
          full_url?: string
          id?: string
          landing_page_id?: string
          removed_at?: string | null
          status?: string
          subdomain?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_deployments_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_experiments: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          landing_page_id: string
          name: string
          start_date: string | null
          status: string
          traffic_split_strategy: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          landing_page_id: string
          name: string
          start_date?: string | null
          status?: string
          traffic_split_strategy?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          landing_page_id?: string
          name?: string
          start_date?: string | null
          status?: string
          traffic_split_strategy?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_metric_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          landing_page_id: string
          medium: string | null
          metadata: Json | null
          referral_code: string | null
          revenue_generated: number
          session_id: string | null
          source: string | null
          tenant_created: boolean
          variant_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          landing_page_id: string
          medium?: string | null
          metadata?: Json | null
          referral_code?: string | null
          revenue_generated?: number
          session_id?: string | null
          source?: string | null
          tenant_created?: boolean
          variant_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          landing_page_id?: string
          medium?: string | null
          metadata?: Json | null
          referral_code?: string | null
          revenue_generated?: number
          session_id?: string | null
          source?: string | null
          tenant_created?: boolean
          variant_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_metric_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "landing_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_approval_requests: {
        Row: {
          created_at: string
          id: string
          landing_page_id: string
          page_snapshot: Json
          published_at: string | null
          published_by: string | null
          published_by_user_id: string | null
          review_decision: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_user_id: string | null
          status: string
          submission_notes: string | null
          submitted_at: string
          submitted_by: string
          submitted_by_user_id: string
          updated_at: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          landing_page_id: string
          page_snapshot?: Json
          published_at?: string | null
          published_by?: string | null
          published_by_user_id?: string | null
          review_decision?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          submission_notes?: string | null
          submitted_at?: string
          submitted_by: string
          submitted_by_user_id: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          landing_page_id?: string
          page_snapshot?: Json
          published_at?: string | null
          published_by?: string | null
          published_by_user_id?: string | null
          review_decision?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          submission_notes?: string | null
          submitted_at?: string
          submitted_by?: string
          submitted_by_user_id?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_approval_requests_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_governance_logs: {
        Row: {
          action: string
          approval_request_id: string
          created_at: string
          id: string
          landing_page_id: string
          metadata: Json | null
          notes: string | null
          performed_by: string
          performed_by_user_id: string
        }
        Insert: {
          action: string
          approval_request_id: string
          created_at?: string
          id?: string
          landing_page_id: string
          metadata?: Json | null
          notes?: string | null
          performed_by: string
          performed_by_user_id: string
        }
        Update: {
          action?: string
          approval_request_id?: string
          created_at?: string
          id?: string
          landing_page_id?: string
          metadata?: Json | null
          notes?: string | null
          performed_by?: string
          performed_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_governance_logs_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "landing_page_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_governance_logs_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_versions: {
        Row: {
          content_snapshot: Json
          created_at: string
          created_by: string | null
          fab_snapshot: Json
          id: string
          landing_page_id: string
          seo_snapshot: Json
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          content_snapshot?: Json
          created_at?: string
          created_by?: string | null
          fab_snapshot?: Json
          id?: string
          landing_page_id: string
          seo_snapshot?: Json
          status?: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          content_snapshot?: Json
          created_at?: string
          created_by?: string | null
          fab_snapshot?: Json
          id?: string
          landing_page_id?: string
          seo_snapshot?: Json
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_versions_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          analytics: Json
          blocks: Json
          cloudflare_record_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deploy_url: string | null
          deployed_at: string | null
          gtm_container_id: string | null
          id: string
          name: string
          preview_token: string | null
          published_at: string | null
          referral_program_id: string | null
          slug: string
          status: string
          subdomain: string | null
          target_plan_id: string | null
          updated_at: string
        }
        Insert: {
          analytics?: Json
          blocks?: Json
          cloudflare_record_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deploy_url?: string | null
          deployed_at?: string | null
          gtm_container_id?: string | null
          id?: string
          name: string
          preview_token?: string | null
          published_at?: string | null
          referral_program_id?: string | null
          slug: string
          status?: string
          subdomain?: string | null
          target_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          analytics?: Json
          blocks?: Json
          cloudflare_record_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deploy_url?: string | null
          deployed_at?: string | null
          gtm_container_id?: string | null
          id?: string
          name?: string
          preview_token?: string | null
          published_at?: string | null
          referral_program_id?: string | null
          slug?: string
          status?: string
          subdomain?: string | null
          target_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_target_plan_id_fkey"
            columns: ["target_plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_traffic_allocations: {
        Row: {
          allocated_at: string
          experiment_id: string
          id: string
          variant_id: string
          visitor_id: string
        }
        Insert: {
          allocated_at?: string
          experiment_id: string
          id?: string
          variant_id: string
          visitor_id: string
        }
        Update: {
          allocated_at?: string
          experiment_id?: string
          id?: string
          variant_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_traffic_allocations_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "landing_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_traffic_allocations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "landing_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_variants: {
        Row: {
          created_at: string
          cta_variant: string | null
          experiment_id: string
          fab_structure_snapshot: Json | null
          headline_variant: string | null
          id: string
          updated_at: string
          version_id: string | null
          weight_percentage: number
        }
        Insert: {
          created_at?: string
          cta_variant?: string | null
          experiment_id: string
          fab_structure_snapshot?: Json | null
          headline_variant?: string | null
          id?: string
          updated_at?: string
          version_id?: string | null
          weight_percentage?: number
        }
        Update: {
          created_at?: string
          cta_variant?: string | null
          experiment_id?: string
          fab_structure_snapshot?: Json | null
          headline_variant?: string | null
          id?: string
          updated_at?: string
          version_id?: string | null
          weight_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "landing_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_versions: {
        Row: {
          change_notes: string | null
          content_snapshot: Json
          created_at: string
          created_by: string | null
          id: string
          landing_page_id: string
          status: string
          version_number: number
        }
        Insert: {
          change_notes?: string | null
          content_snapshot?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          landing_page_id: string
          status?: string
          version_number?: number
        }
        Update: {
          change_notes?: string | null
          content_snapshot?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          landing_page_id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_versions_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          codigo: string
          conteudo_texto: string | null
          created_at: string
          data_publicacao: string
          ementa: string | null
          fonte: string | null
          hash_conteudo: string
          id: string
          is_current: boolean
          metadata: Json | null
          substituida_por: string | null
          tenant_id: string
          tipo: string
          titulo: string
          url_original: string | null
          versao: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          codigo: string
          conteudo_texto?: string | null
          created_at?: string
          data_publicacao: string
          ementa?: string | null
          fonte?: string | null
          hash_conteudo: string
          id?: string
          is_current?: boolean
          metadata?: Json | null
          substituida_por?: string | null
          tenant_id: string
          tipo: string
          titulo: string
          url_original?: string | null
          versao?: number
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          codigo?: string
          conteudo_texto?: string | null
          created_at?: string
          data_publicacao?: string
          ementa?: string | null
          fonte?: string | null
          hash_conteudo?: string
          id?: string
          is_current?: boolean
          metadata?: Json | null
          substituida_por?: string | null
          tenant_id?: string
          tipo?: string
          titulo?: string
          url_original?: string | null
          versao?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_substituida_por_fkey"
            columns: ["substituida_por"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_interpretation_logs: {
        Row: {
          acoes_geradas: Json
          created_at: string
          created_by: string | null
          id: string
          impacto: Json
          modelo_utilizado: string | null
          mudanca_id: string
          norm_codigo: string | null
          resumo: string
          risco_nivel: string
          tenant_id: string
        }
        Insert: {
          acoes_geradas?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          impacto?: Json
          modelo_utilizado?: string | null
          mudanca_id: string
          norm_codigo?: string | null
          resumo: string
          risco_nivel?: string
          tenant_id: string
        }
        Update: {
          acoes_geradas?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          impacto?: Json
          modelo_utilizado?: string | null
          mudanca_id?: string
          norm_codigo?: string | null
          resumo?: string
          risco_nivel?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_interpretation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_references: {
        Row: {
          categoria_profissional: string | null
          codigo_referencia: string
          created_at: string
          id: string
          obrigatoriedade: boolean
          resumo: string | null
          tenant_id: string
          tipo: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          categoria_profissional?: string | null
          codigo_referencia: string
          created_at?: string
          id?: string
          obrigatoriedade?: boolean
          resumo?: string | null
          tenant_id: string
          tipo: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          categoria_profissional?: string | null
          codigo_referencia?: string
          created_at?: string
          id?: string
          obrigatoriedade?: boolean
          resumo?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_references_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_anonymization_requests: {
        Row: {
          created_at: string
          employee_id: string
          entity_type: string
          id: string
          legal_basis: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_by: string
          retention_end_date: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          entity_type?: string
          id?: string
          legal_basis?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by: string
          retention_end_date?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          entity_type?: string
          id?: string
          legal_basis?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by?: string
          retention_end_date?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_anonymization_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_anonymization_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_consent_records: {
        Row: {
          created_at: string
          expires_at: string | null
          granted: boolean
          granted_at: string | null
          id: string
          ip_address: string | null
          legal_basis: string | null
          purpose: string
          revoked_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: string | null
          legal_basis?: string | null
          purpose: string
          revoked_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: string | null
          legal_basis?: string | null
          purpose?: string
          revoked_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_consent_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_legal_basis: {
        Row: {
          created_at: string
          data_category: string
          description: string
          id: string
          is_active: boolean
          legal_basis_type: string
          lgpd_article: string
          retention_period_months: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_category: string
          description: string
          id?: string
          is_active?: boolean
          legal_basis_type: string
          lgpd_article: string
          retention_period_months?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_category?: string
          description?: string
          id?: string
          is_active?: boolean
          legal_basis_type?: string
          lgpd_article?: string
          retention_period_months?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_legal_basis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_display_tokens: {
        Row: {
          created_at: string
          display_id: string | null
          expira_em: string
          id: string
          paired_at: string | null
          paired_ip: string | null
          paired_user_agent: string | null
          pairing_code: string | null
          status: Database["public"]["Enums"]["display_session_status"]
          tenant_id: string | null
          token_temporario: string
        }
        Insert: {
          created_at?: string
          display_id?: string | null
          expira_em: string
          id?: string
          paired_at?: string | null
          paired_ip?: string | null
          paired_user_agent?: string | null
          pairing_code?: string | null
          status?: Database["public"]["Enums"]["display_session_status"]
          tenant_id?: string | null
          token_temporario: string
        }
        Update: {
          created_at?: string
          display_id?: string | null
          expira_em?: string
          id?: string
          paired_at?: string | null
          paired_ip?: string | null
          paired_user_agent?: string | null
          pairing_code?: string | null
          status?: Database["public"]["Enums"]["display_session_status"]
          tenant_id?: string | null
          token_temporario?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_display_tokens_display_id_fkey"
            columns: ["display_id"]
            isOneToOne: false
            referencedRelation: "live_displays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_display_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_displays: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string | null
          id: string
          intervalo_rotacao: number
          last_seen_at: string | null
          layout_config: Json
          nome: string
          rotacao_automatica: boolean
          status: Database["public"]["Enums"]["display_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["display_board_tipo"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          id?: string
          intervalo_rotacao?: number
          last_seen_at?: string | null
          layout_config?: Json
          nome: string
          rotacao_automatica?: boolean
          status?: Database["public"]["Enums"]["display_status"]
          tenant_id: string
          tipo?: Database["public"]["Enums"]["display_board_tipo"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          id?: string
          intervalo_rotacao?: number
          last_seen_at?: string | null
          layout_config?: Json
          nome?: string
          rotacao_automatica?: boolean
          status?: Database["public"]["Enums"]["display_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["display_board_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_displays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_displays_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_displays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_campaigns: {
        Row: {
          campaign_name: string
          created_at: string
          created_by: string
          daily_budget_cents: number
          error_message: string | null
          id: string
          is_active_version: boolean
          landing_page_id: string
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          preview_url: string | null
          status: string
          targeting: Json | null
          tenant_id: string
          updated_at: string
          version_number: number
        }
        Insert: {
          campaign_name: string
          created_at?: string
          created_by: string
          daily_budget_cents?: number
          error_message?: string | null
          id?: string
          is_active_version?: boolean
          landing_page_id: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          preview_url?: string | null
          status?: string
          targeting?: Json | null
          tenant_id: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          campaign_name?: string
          created_at?: string
          created_by?: string
          daily_budget_cents?: number
          error_message?: string | null
          id?: string
          is_active_version?: boolean
          landing_page_id?: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          preview_url?: string | null
          status?: string
          targeting?: Json | null
          tenant_id?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_campaigns_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_connections: {
        Row: {
          access_token: string
          ad_account_id: string
          connected_by: string
          created_at: string
          id: string
          is_active: boolean
          page_id: string | null
          pixel_id: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          ad_account_id: string
          connected_by: string
          created_at?: string
          id?: string
          is_active?: boolean
          page_id?: string | null
          pixel_id?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string
          connected_by?: string
          created_at?: string
          id?: string
          is_active?: boolean
          page_id?: string | null
          pixel_id?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_versions: {
        Row: {
          breaking_changes: boolean
          changelog_summary: string
          created_at: string
          created_by: string
          dependencies: Json
          id: string
          module_id: string
          platform_console_version: string | null
          released_at: string | null
          status: string
          tenant_app_version: string | null
          version_major: number
          version_minor: number
          version_patch: number
          version_prerelease: string | null
          version_tag: string
        }
        Insert: {
          breaking_changes?: boolean
          changelog_summary?: string
          created_at?: string
          created_by: string
          dependencies?: Json
          id?: string
          module_id: string
          platform_console_version?: string | null
          released_at?: string | null
          status?: string
          tenant_app_version?: string | null
          version_major?: number
          version_minor?: number
          version_patch?: number
          version_prerelease?: string | null
          version_tag: string
        }
        Update: {
          breaking_changes?: boolean
          changelog_summary?: string
          created_at?: string
          created_by?: string
          dependencies?: Json
          id?: string
          module_id?: string
          platform_console_version?: string | null
          released_at?: string | null
          status?: string
          tenant_app_version?: string | null
          version_major?: number
          version_minor?: number
          version_patch?: number
          version_prerelease?: string | null
          version_tag?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_command: string | null
          action_url: string | null
          company_id: string | null
          created_at: string
          description: string
          group_id: string | null
          id: string
          is_read: boolean
          source_module: string | null
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          action_command?: string | null
          action_url?: string | null
          company_id?: string | null
          created_at?: string
          description: string
          group_id?: string | null
          id?: string
          is_read?: boolean
          source_module?: string | null
          tenant_id: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          action_command?: string | null
          action_url?: string | null
          company_id?: string | null
          created_at?: string
          description?: string
          group_id?: string | null
          id?: string
          is_read?: boolean
          source_module?: string | null
          tenant_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nr_training_assignments: {
        Row: {
          agreement_id: string | null
          blocking_level: string
          cbo_code: string | null
          certificado_url: string | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          data_realizacao: string | null
          data_validade: string | null
          due_date: string | null
          employee_id: string
          id: string
          instrutor: string | null
          is_renewal: boolean
          legal_basis: string | null
          nr_number: number
          previous_assignment_id: string | null
          renewal_number: number
          required_hours: number
          status: string
          tenant_id: string
          termo_assinado_url: string | null
          training_name: string
          trigger: string
          updated_at: string
          validity_months: number | null
          waiver_approved_by: string | null
          waiver_reason: string | null
        }
        Insert: {
          agreement_id?: string | null
          blocking_level?: string
          cbo_code?: string | null
          certificado_url?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          data_realizacao?: string | null
          data_validade?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          instrutor?: string | null
          is_renewal?: boolean
          legal_basis?: string | null
          nr_number: number
          previous_assignment_id?: string | null
          renewal_number?: number
          required_hours?: number
          status?: string
          tenant_id: string
          termo_assinado_url?: string | null
          training_name: string
          trigger?: string
          updated_at?: string
          validity_months?: number | null
          waiver_approved_by?: string | null
          waiver_reason?: string | null
        }
        Update: {
          agreement_id?: string | null
          blocking_level?: string
          cbo_code?: string | null
          certificado_url?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          data_realizacao?: string | null
          data_validade?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          instrutor?: string | null
          is_renewal?: boolean
          legal_basis?: string | null
          nr_number?: number
          previous_assignment_id?: string | null
          renewal_number?: number
          required_hours?: number
          status?: string
          tenant_id?: string
          termo_assinado_url?: string | null
          training_name?: string
          trigger?: string
          updated_at?: string
          validity_months?: number | null
          waiver_approved_by?: string | null
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nr_training_assignments_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_assignments_previous_assignment_id_fkey"
            columns: ["previous_assignment_id"]
            isOneToOne: false
            referencedRelation: "nr_training_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nr_training_audit_log: {
        Row: {
          assignment_id: string
          created_at: string
          employee_id: string
          from_status: string | null
          id: string
          metadata: Json | null
          performed_by: string | null
          reason: string | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          employee_id: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string | null
          reason?: string | null
          tenant_id: string
          to_status: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          employee_id?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string | null
          reason?: string | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nr_training_audit_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "nr_training_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nr_training_catalog: {
        Row: {
          base_legal: string | null
          carga_horaria_minima: number
          created_at: string
          descricao: string | null
          exige_assinatura_termo: boolean
          exige_avaliacao_medica: boolean
          exige_reciclagem: boolean
          id: string
          is_active: boolean
          is_system: boolean
          nome: string
          nr_codigo: number
          obrigatoria_para_grau_risco: number[]
          periodicidade: string
          target_cbos: string[]
          tenant_id: string
          updated_at: string
          validade_meses: number | null
        }
        Insert: {
          base_legal?: string | null
          carga_horaria_minima?: number
          created_at?: string
          descricao?: string | null
          exige_assinatura_termo?: boolean
          exige_avaliacao_medica?: boolean
          exige_reciclagem?: boolean
          id?: string
          is_active?: boolean
          is_system?: boolean
          nome: string
          nr_codigo: number
          obrigatoria_para_grau_risco?: number[]
          periodicidade?: string
          target_cbos?: string[]
          tenant_id: string
          updated_at?: string
          validade_meses?: number | null
        }
        Update: {
          base_legal?: string | null
          carga_horaria_minima?: number
          created_at?: string
          descricao?: string | null
          exige_assinatura_termo?: boolean
          exige_avaliacao_medica?: boolean
          exige_reciclagem?: boolean
          id?: string
          is_active?: boolean
          is_system?: boolean
          nome?: string
          nr_codigo?: number
          obrigatoria_para_grau_risco?: number[]
          periodicidade?: string
          target_cbos?: string[]
          tenant_id?: string
          updated_at?: string
          validade_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nr_training_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nr_training_completions: {
        Row: {
          assignment_id: string
          certificate_number: string | null
          certificate_url: string | null
          completed_at: string
          created_at: string
          employee_id: string
          expires_at: string | null
          hours_completed: number
          id: string
          instructor_name: string | null
          location: string | null
          methodology: string | null
          observations: string | null
          passed: boolean
          provider_name: string | null
          registered_by: string | null
          score: number | null
          tenant_id: string
        }
        Insert: {
          assignment_id: string
          certificate_number?: string | null
          certificate_url?: string | null
          completed_at: string
          created_at?: string
          employee_id: string
          expires_at?: string | null
          hours_completed: number
          id?: string
          instructor_name?: string | null
          location?: string | null
          methodology?: string | null
          observations?: string | null
          passed?: boolean
          provider_name?: string | null
          registered_by?: string | null
          score?: number | null
          tenant_id: string
        }
        Update: {
          assignment_id?: string
          certificate_number?: string | null
          certificate_url?: string | null
          completed_at?: string
          created_at?: string
          employee_id?: string
          expires_at?: string | null
          hours_completed?: number
          id?: string
          instructor_name?: string | null
          location?: string | null
          methodology?: string | null
          observations?: string | null
          passed?: boolean
          provider_name?: string | null
          registered_by?: string | null
          score?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nr_training_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "nr_training_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nr_training_completions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      occupational_risk_factors: {
        Row: {
          category: Database["public"]["Enums"]["risk_category"]
          code: string
          created_at: string
          description: string | null
          esocial_code: string | null
          exposure_limit: string | null
          id: string
          is_active: boolean
          measurement_unit: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["risk_category"]
          code: string
          created_at?: string
          description?: string | null
          esocial_code?: string | null
          exposure_limit?: string | null
          id?: string
          is_active?: boolean
          measurement_unit?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["risk_category"]
          code?: string
          created_at?: string
          description?: string | null
          esocial_code?: string | null
          exposure_limit?: string | null
          id?: string
          is_active?: boolean
          measurement_unit?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupational_risk_factors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          last_step: string | null
          steps_completed: string[]
          steps_skipped: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          last_step?: string | null
          steps_completed?: string[]
          steps_skipped?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          last_step?: string | null
          steps_completed?: string[]
          steps_skipped?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_policies: {
        Row: {
          allow_installments: boolean
          allowed_methods: string[]
          auto_cancel_after_days: number
          auto_suspend_after_days: number
          created_at: string
          id: string
          late_payment_grace_days: number
          max_installments: number
          min_commitment_months: number
          plan_id: string
          requires_contract: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_installments?: boolean
          allowed_methods?: string[]
          auto_cancel_after_days?: number
          auto_suspend_after_days?: number
          created_at?: string
          id?: string
          late_payment_grace_days?: number
          max_installments?: number
          min_commitment_months?: number
          plan_id: string
          requires_contract?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_installments?: boolean
          allowed_methods?: string[]
          auto_cancel_after_days?: number
          auto_suspend_after_days?: number
          created_at?: string
          id?: string
          late_payment_grace_days?: number
          max_installments?: number
          min_commitment_months?: number
          plan_id?: string
          requires_contract?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_policies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_item_catalog: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          esocial_code: string | null
          id: string
          incidence: Database["public"]["Enums"]["payroll_incidence"]
          is_active: boolean
          is_system: boolean
          item_type: Database["public"]["Enums"]["payroll_item_type"]
          name: string
          nature: Database["public"]["Enums"]["payroll_item_nature"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          esocial_code?: string | null
          id?: string
          incidence?: Database["public"]["Enums"]["payroll_incidence"]
          is_active?: boolean
          is_system?: boolean
          item_type: Database["public"]["Enums"]["payroll_item_type"]
          name: string
          nature?: Database["public"]["Enums"]["payroll_item_nature"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          esocial_code?: string | null
          id?: string
          incidence?: Database["public"]["Enums"]["payroll_incidence"]
          is_active?: boolean
          is_system?: boolean
          item_type?: Database["public"]["Enums"]["payroll_item_type"]
          name?: string
          nature?: Database["public"]["Enums"]["payroll_item_nature"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_item_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_simulations: {
        Row: {
          beneficios: number
          company_group_id: string | null
          company_id: string | null
          competencia: string
          created_at: string
          created_by: string | null
          custo_total_empresa: number
          deleted_at: string | null
          employee_id: string
          encargos_estimados: number
          fator_custo: number
          fgts: number
          id: string
          input_snapshot: Json
          inss_empregado: number
          inss_patronal: number
          irrf: number
          provisao_13: number
          provisao_ferias: number
          provisao_multa_fgts: number
          rat: number
          rubrics_snapshot: Json
          salario_base: number
          salario_liquido: number
          tenant_id: string
          terceiros: number
          total_descontos: number
          total_proventos: number
        }
        Insert: {
          beneficios?: number
          company_group_id?: string | null
          company_id?: string | null
          competencia: string
          created_at?: string
          created_by?: string | null
          custo_total_empresa?: number
          deleted_at?: string | null
          employee_id: string
          encargos_estimados?: number
          fator_custo?: number
          fgts?: number
          id?: string
          input_snapshot?: Json
          inss_empregado?: number
          inss_patronal?: number
          irrf?: number
          provisao_13?: number
          provisao_ferias?: number
          provisao_multa_fgts?: number
          rat?: number
          rubrics_snapshot?: Json
          salario_base?: number
          salario_liquido?: number
          tenant_id: string
          terceiros?: number
          total_descontos?: number
          total_proventos?: number
        }
        Update: {
          beneficios?: number
          company_group_id?: string | null
          company_id?: string | null
          competencia?: string
          created_at?: string
          created_by?: string | null
          custo_total_empresa?: number
          deleted_at?: string | null
          employee_id?: string
          encargos_estimados?: number
          fator_custo?: number
          fgts?: number
          id?: string
          input_snapshot?: Json
          inss_empregado?: number
          inss_patronal?: number
          irrf?: number
          provisao_13?: number
          provisao_ferias?: number
          provisao_multa_fgts?: number
          rat?: number
          rubrics_snapshot?: Json
          salario_base?: number
          salario_liquido?: number
          tenant_id?: string
          terceiros?: number
          total_descontos?: number
          total_proventos?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_simulations_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_simulations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_simulations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_simulations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      plan_modules: {
        Row: {
          created_at: string
          id: string
          module_key: string
          module_price_override: number | null
          plan_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          module_price_override?: number | null
          plan_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          module_price_override?: number | null
          plan_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_access_scopes: {
        Row: {
          created_at: string
          id: string
          role_id: string
          scope_id: string | null
          scope_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          scope_id?: string | null
          scope_type: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          scope_id?: string | null
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_access_scopes_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_changelogs: {
        Row: {
          author: string | null
          category: string | null
          change_type: string
          changed_at: string
          changed_by: string
          description: string | null
          entity_id: string
          entity_scope: string | null
          entity_type: string
          id: string
          linked_release_id: string | null
          linked_version_id: string | null
          module_id: string | null
          payload_diff: Json
          scope: string | null
          scope_key: string | null
          tags: string[] | null
          title: string | null
          version_tag: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          change_type: string
          changed_at?: string
          changed_by: string
          description?: string | null
          entity_id: string
          entity_scope?: string | null
          entity_type: string
          id?: string
          linked_release_id?: string | null
          linked_version_id?: string | null
          module_id?: string | null
          payload_diff?: Json
          scope?: string | null
          scope_key?: string | null
          tags?: string[] | null
          title?: string | null
          version_tag: string
        }
        Update: {
          author?: string | null
          category?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string
          description?: string | null
          entity_id?: string
          entity_scope?: string | null
          entity_type?: string
          id?: string
          linked_release_id?: string | null
          linked_version_id?: string | null
          module_id?: string | null
          payload_diff?: Json
          scope?: string | null
          scope_key?: string | null
          tags?: string[] | null
          title?: string | null
          version_tag?: string
        }
        Relationships: []
      }
      platform_cognitive_events: {
        Row: {
          created_at: string
          event_key: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      platform_financial_entries: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          entry_type: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          source_plan_id: string | null
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          entry_type: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          source_plan_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          entry_type?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          source_plan_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_financial_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_financial_entries_source_plan_id_fkey"
            columns: ["source_plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_financial_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          sent_by: string | null
          subject: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          sent_by?: string | null
          subject?: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          sent_by?: string | null
          subject?: string
          user_email?: string
        }
        Relationships: []
      }
      platform_permission_definitions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          domain: string
          id: string
          module: string
          resource: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          module: string
          resource: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          module?: string
          resource?: string
        }
        Relationships: []
      }
      platform_role_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["platform_role"]
          role_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["platform_role"]
          role_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "platform_permission_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          inherits_role_ids: string[] | null
          is_system_role: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          inherits_role_ids?: string[] | null
          is_system_role?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          inherits_role_ids?: string[] | null
          is_system_role?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      platform_users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_versions: {
        Row: {
          changelog_entries: string[]
          created_at: string
          description: string
          id: string
          modules_included: string[]
          release_id: string | null
          release_type: string
          released_at: string | null
          released_by: string
          rollback_from: string | null
          status: string
          title: string
          version_build: string | null
          version_major: number
          version_minor: number
          version_patch: number
          version_prerelease: string | null
          version_tag: string
        }
        Insert: {
          changelog_entries?: string[]
          created_at?: string
          description?: string
          id?: string
          modules_included?: string[]
          release_id?: string | null
          release_type?: string
          released_at?: string | null
          released_by: string
          rollback_from?: string | null
          status?: string
          title: string
          version_build?: string | null
          version_major?: number
          version_minor?: number
          version_patch?: number
          version_prerelease?: string | null
          version_tag: string
        }
        Update: {
          changelog_entries?: string[]
          created_at?: string
          description?: string
          id?: string
          modules_included?: string[]
          release_id?: string | null
          release_type?: string
          released_at?: string | null
          released_by?: string
          rollback_from?: string | null
          status?: string
          title?: string
          version_build?: string | null
          version_major?: number
          version_minor?: number
          version_patch?: number
          version_prerelease?: string | null
          version_tag?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          ativo: boolean
          cbo_code: string | null
          certificacoes_exigidas: string[] | null
          company_group_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          descricao: string | null
          faixa_salarial_max: number | null
          faixa_salarial_min: number | null
          formacao_minima: string | null
          id: string
          level: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cbo_code?: string | null
          certificacoes_exigidas?: string[] | null
          company_group_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          formacao_minima?: string | null
          id?: string
          level?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cbo_code?: string | null
          certificacoes_exigidas?: string[] | null
          company_group_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          formacao_minima?: string | null
          id?: string
          level?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_tracking_events: {
        Row: {
          device_id: string
          event_timestamp: string
          id: string
          ignition: boolean | null
          ingested_at: string
          integrity_hash: string | null
          latitude: number
          longitude: number
          raw_payload: Json | null
          speed: number
          tenant_id: string
        }
        Insert: {
          device_id: string
          event_timestamp: string
          id?: string
          ignition?: boolean | null
          ingested_at?: string
          integrity_hash?: string | null
          latitude: number
          longitude: number
          raw_payload?: Json | null
          speed?: number
          tenant_id: string
        }
        Update: {
          device_id?: string
          event_timestamp?: string
          id?: string
          ignition?: boolean | null
          ingested_at?: string
          integrity_hash?: string | null
          latitude?: number
          longitude?: number
          raw_payload?: Json | null
          speed?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_tracking_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          owner_tenant_id: string | null
          program_id: string | null
          referrer_user_id: string
          total_clicks: number
          total_conversions: number
          total_reward_brl: number
          total_signups: number
          updated_at: string
          url: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          owner_tenant_id?: string | null
          program_id?: string | null
          referrer_user_id: string
          total_clicks?: number
          total_conversions?: number
          total_reward_brl?: number
          total_signups?: number
          updated_at?: string
          url: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          owner_tenant_id?: string | null
          program_id?: string | null
          referrer_user_id?: string
          total_clicks?: number
          total_conversions?: number
          total_reward_brl?: number
          total_signups?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_owner_tenant_id_fkey"
            columns: ["owner_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "referral_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_programs: {
        Row: {
          conditions: Json
          created_at: string
          created_by: string | null
          current_redemptions: number
          description: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_plan_tier: string | null
          name: string
          reward_type: string
          reward_value: number
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          conditions?: Json
          created_at?: string
          created_by?: string | null
          current_redemptions?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_plan_tier?: string | null
          name: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          conditions?: Json
          created_at?: string
          created_by?: string | null
          current_redemptions?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_plan_tier?: string | null
          name?: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          amount_brl: number
          approved_at: string | null
          created_at: string
          description: string | null
          id: string
          paid_at: string | null
          referrer_user_id: string
          reward_type: string
          status: string
          tracking_id: string | null
        }
        Insert: {
          amount_brl?: number
          approved_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          referrer_user_id: string
          reward_type?: string
          status?: string
          tracking_id?: string | null
        }
        Update: {
          amount_brl?: number
          approved_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          referrer_user_id?: string
          reward_type?: string
          status?: string
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "referral_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_tracking: {
        Row: {
          converted_at: string | null
          created_at: string
          first_payment_brl: number | null
          id: string
          plan_id: string | null
          referral_link_id: string
          referred_tenant_id: string
          referrer_user_id: string
          reward_brl: number | null
          reward_paid_at: string | null
          signed_up_at: string
          status: string
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          first_payment_brl?: number | null
          id?: string
          plan_id?: string | null
          referral_link_id: string
          referred_tenant_id: string
          referrer_user_id: string
          reward_brl?: number | null
          reward_paid_at?: string | null
          signed_up_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          first_payment_brl?: number | null
          id?: string
          plan_id?: string | null
          referral_link_id?: string
          referred_tenant_id?: string
          referrer_user_id?: string
          reward_brl?: number | null
          reward_paid_at?: string | null
          signed_up_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_tracking_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_tracking_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_tracking_referred_tenant_id_fkey"
            columns: ["referred_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_audit_log: {
        Row: {
          actor_id: string
          actor_role: string | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          descricao: string
          document_code: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          actor_id: string
          actor_role?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          descricao: string
          document_code?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string
          actor_role?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          descricao?: string
          document_code?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_source_configs: {
        Row: {
          configurado_em: string
          configurado_por: string
          credenciais_ref: string | null
          frequencia_verificacao: string
          id: string
          is_active: boolean
          metadata: Json | null
          nome: string
          source_type: string
          tenant_id: string
          tipos_monitorados: string[]
          updated_at: string
          url_base: string | null
        }
        Insert: {
          configurado_em?: string
          configurado_por: string
          credenciais_ref?: string | null
          frequencia_verificacao?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          nome: string
          source_type: string
          tenant_id: string
          tipos_monitorados?: string[]
          updated_at?: string
          url_base?: string | null
        }
        Update: {
          configurado_em?: string
          configurado_por?: string
          credenciais_ref?: string | null
          frequencia_verificacao?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          nome?: string
          source_type?: string
          tenant_id?: string
          tipos_monitorados?: string[]
          updated_at?: string
          url_base?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_source_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_trend_snapshots: {
        Row: {
          ai_forecast: string | null
          critical_count: number
          forecast_confidence: number | null
          forecast_risk_level: string | null
          high_count: number
          high_risk_users: number
          id: string
          low_count: number
          medium_count: number
          risk_level: string
          risk_score: number
          signal_count: number
          snapshot_at: string
          tenant_id: string
          top_signals: Json
          trend_metadata: Json
          user_count: number
        }
        Insert: {
          ai_forecast?: string | null
          critical_count?: number
          forecast_confidence?: number | null
          forecast_risk_level?: string | null
          high_count?: number
          high_risk_users?: number
          id?: string
          low_count?: number
          medium_count?: number
          risk_level?: string
          risk_score?: number
          signal_count?: number
          snapshot_at?: string
          tenant_id: string
          top_signals?: Json
          trend_metadata?: Json
          user_count?: number
        }
        Update: {
          ai_forecast?: string | null
          critical_count?: number
          forecast_confidence?: number | null
          forecast_risk_level?: string | null
          high_count?: number
          high_risk_users?: number
          id?: string
          low_count?: number
          medium_count?: number
          risk_level?: string
          risk_score?: number
          signal_count?: number
          snapshot_at?: string
          tenant_id?: string
          top_signals?: Json
          trend_metadata?: Json
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_trend_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_inheritance: {
        Row: {
          child_role_id: string
          created_at: string
          created_by: string | null
          id: string
          parent_role_id: string
          tenant_id: string
        }
        Insert: {
          child_role_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          parent_role_id: string
          tenant_id: string
        }
        Update: {
          child_role_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          parent_role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_inheritance_child_role_id_fkey"
            columns: ["child_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_inheritance_parent_role_id_fkey"
            columns: ["parent_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_inheritance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission_id: string
          role_id: string
          scope_type: Database["public"]["Enums"]["permission_scope"]
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_id: string
          role_id: string
          scope_type?: Database["public"]["Enums"]["permission_scope"]
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_id?: string
          role_id?: string
          scope_type?: Database["public"]["Enums"]["permission_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rollback_plans: {
        Row: {
          breaking_rollback: boolean
          created_at: string
          created_by: string
          dependency_safe: boolean
          id: string
          modules_affected: string[]
          modules_skipped: string[]
          release_id: string | null
          scope: string
          steps: Json
          target_release_id: string | null
        }
        Insert: {
          breaking_rollback?: boolean
          created_at?: string
          created_by: string
          dependency_safe?: boolean
          id?: string
          modules_affected?: string[]
          modules_skipped?: string[]
          release_id?: string | null
          scope?: string
          steps?: Json
          target_release_id?: string | null
        }
        Update: {
          breaking_rollback?: boolean
          created_at?: string
          created_by?: string
          dependency_safe?: boolean
          id?: string
          modules_affected?: string[]
          modules_skipped?: string[]
          release_id?: string | null
          scope?: string
          steps?: Json
          target_release_id?: string | null
        }
        Relationships: []
      }
      saas_plans: {
        Row: {
          allowed_modules: string[]
          allowed_payment_methods: string[]
          billing_cycle: string
          created_at: string
          description: string | null
          feature_flags: string[]
          id: string
          is_active: boolean
          name: string
          price: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_modules?: string[]
          allowed_payment_methods?: string[]
          billing_cycle?: string
          created_at?: string
          description?: string | null
          feature_flags?: string[]
          id?: string
          is_active?: boolean
          name: string
          price?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_modules?: string[]
          allowed_payment_methods?: string[]
          billing_cycle?: string
          created_at?: string
          description?: string | null
          feature_flags?: string[]
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_automation_audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          executor: string
          executor_user_id: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          workflow_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          executor?: string
          executor_user_id?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          workflow_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          executor?: string
          executor_user_id?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_automation_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_automation_audit_log_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "safety_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_escalation_policies: {
        Row: {
          created_at: string
          current_priority: string
          description: string | null
          dias_sem_resposta: number
          escalation_level: number
          id: string
          is_active: boolean
          max_escalations: number
          name: string
          nova_prioridade: string
          novo_responsavel: string
          novo_responsavel_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_priority?: string
          description?: string | null
          dias_sem_resposta?: number
          escalation_level?: number
          id?: string
          is_active?: boolean
          max_escalations?: number
          name: string
          nova_prioridade?: string
          novo_responsavel?: string
          novo_responsavel_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_priority?: string
          description?: string | null
          dias_sem_resposta?: number
          escalation_level?: number
          id?: string
          is_active?: boolean
          max_escalations?: number
          name?: string
          nova_prioridade?: string
          novo_responsavel?: string
          novo_responsavel_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_escalation_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_playbooks: {
        Row: {
          acoes: Json
          condicao: Json
          cooldown_hours: number
          created_at: string
          created_by: string | null
          description: string | null
          evento_origem: string
          id: string
          is_active: boolean
          is_system: boolean
          last_triggered_at: string | null
          min_severity: string
          name: string
          priority: number
          tenant_id: string
          trigger_count: number
          updated_at: string
        }
        Insert: {
          acoes?: Json
          condicao?: Json
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          evento_origem: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          last_triggered_at?: string | null
          min_severity?: string
          name: string
          priority?: number
          tenant_id: string
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          acoes?: Json
          condicao?: Json
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          evento_origem?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          last_triggered_at?: string | null
          min_severity?: string
          name?: string
          priority?: number
          tenant_id?: string
          trigger_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_playbooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          descricao: string
          employee_id: string | null
          escalation_count: number
          escalation_history: Json
          id: string
          last_escalated_at: string | null
          metadata: Json | null
          prazo: string
          priority: string
          responsavel_user_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          descricao: string
          employee_id?: string | null
          escalation_count?: number
          escalation_history?: Json
          id?: string
          last_escalated_at?: string | null
          metadata?: Json | null
          prazo: string
          priority?: string
          responsavel_user_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          descricao?: string
          employee_id?: string | null
          escalation_count?: number
          escalation_history?: Json
          id?: string
          last_escalated_at?: string | null
          metadata?: Json | null
          prazo?: string
          priority?: string
          responsavel_user_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_tasks_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "safety_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_workflows: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          created_at: string
          description: string | null
          employee_id: string | null
          id: string
          metadata: Json | null
          origem_evento: Json
          prioridade: Database["public"]["Enums"]["safety_workflow_priority"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["safety_workflow_status"]
          tenant_id: string
          tipo_workflow: Database["public"]["Enums"]["safety_workflow_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json | null
          origem_evento?: Json
          prioridade?: Database["public"]["Enums"]["safety_workflow_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["safety_workflow_status"]
          tenant_id: string
          tipo_workflow: Database["public"]["Enums"]["safety_workflow_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          metadata?: Json | null
          origem_evento?: Json
          prioridade?: Database["public"]["Enums"]["safety_workflow_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["safety_workflow_status"]
          tenant_id?: string
          tipo_workflow?: Database["public"]["Enums"]["safety_workflow_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_workflows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_workflows_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_additionals: {
        Row: {
          additional_type: Database["public"]["Enums"]["salary_additional_type"]
          amount: number
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          employee_id: string
          end_date: string | null
          id: string
          is_recurring: boolean
          start_date: string
          tenant_id: string
        }
        Insert: {
          additional_type: Database["public"]["Enums"]["salary_additional_type"]
          amount: number
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          is_recurring?: boolean
          start_date?: string
          tenant_id: string
        }
        Update: {
          additional_type?: Database["public"]["Enums"]["salary_additional_type"]
          amount?: number
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          is_recurring?: boolean
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_additionals_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_additionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_additionals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_additionals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["salary_adjustment_type"]
          company_group_id: string | null
          company_id: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          new_salary: number
          percentage: number | null
          previous_salary: number
          reason: string | null
          tenant_id: string
        }
        Insert: {
          adjustment_type: Database["public"]["Enums"]["salary_adjustment_type"]
          company_group_id?: string | null
          company_id?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          new_salary: number
          percentage?: number | null
          previous_salary: number
          reason?: string | null
          tenant_id: string
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["salary_adjustment_type"]
          company_group_id?: string | null
          company_id?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          new_salary?: number
          percentage?: number | null
          previous_salary?: number
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_adjustments_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "salary_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_contracts: {
        Row: {
          base_salary: number
          company_group_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          end_date: string | null
          id: string
          is_active: boolean
          start_date: string
          tenant_id: string
        }
        Insert: {
          base_salary: number
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          start_date?: string
          tenant_id: string
        }
        Update: {
          base_salary?: number
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_contracts_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_history: {
        Row: {
          approved_by: string | null
          company_group_id: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          effective_date: string
          employee_id: string
          id: string
          new_salary: number
          previous_salary: number
          reason: string | null
          tenant_id: string
        }
        Insert: {
          approved_by?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          effective_date: string
          employee_id: string
          id?: string
          new_salary: number
          previous_salary: number
          reason?: string | null
          tenant_id: string
        }
        Update: {
          approved_by?: string | null
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          effective_date?: string
          employee_id?: string
          id?: string
          new_salary?: number
          previous_salary?: number
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_history_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_rubric_templates: {
        Row: {
          codigo: string
          created_at: string
          exige_base_horaria: boolean
          id: string
          integra_fgts: boolean
          integra_inss: boolean
          integra_irrf: boolean
          is_active: boolean
          is_system: boolean
          natureza_juridica: string
          nome: string
          permite_percentual: boolean
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          exige_base_horaria?: boolean
          id?: string
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          is_active?: boolean
          is_system?: boolean
          natureza_juridica: string
          nome: string
          permite_percentual?: boolean
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          exige_base_horaria?: boolean
          id?: string
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          is_active?: boolean
          is_system?: boolean
          natureza_juridica?: string
          nome?: string
          permite_percentual?: boolean
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_rubric_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_rubrics: {
        Row: {
          amount: number
          base_calculo: Database["public"]["Enums"]["rubric_base_calculo"]
          catalog_item_id: string | null
          created_at: string
          deleted_at: string | null
          esocial_code: string | null
          id: string
          integra_fgts: boolean
          integra_inss: boolean
          integra_irrf: boolean
          is_active: boolean
          item_type: Database["public"]["Enums"]["payroll_item_type"]
          name: string
          nature: Database["public"]["Enums"]["payroll_item_nature"]
          percentage: number | null
          rubric_code: string
          salary_structure_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          base_calculo?: Database["public"]["Enums"]["rubric_base_calculo"]
          catalog_item_id?: string | null
          created_at?: string
          deleted_at?: string | null
          esocial_code?: string | null
          id?: string
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["payroll_item_type"]
          name: string
          nature?: Database["public"]["Enums"]["payroll_item_nature"]
          percentage?: number | null
          rubric_code: string
          salary_structure_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          base_calculo?: Database["public"]["Enums"]["rubric_base_calculo"]
          catalog_item_id?: string | null
          created_at?: string
          deleted_at?: string | null
          esocial_code?: string | null
          id?: string
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["payroll_item_type"]
          name?: string
          nature?: Database["public"]["Enums"]["payroll_item_nature"]
          percentage?: number | null
          rubric_code?: string
          salary_structure_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_rubrics_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_item_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_rubrics_salary_structure_id_fkey"
            columns: ["salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_rubrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          company_group_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          end_date: string | null
          id: string
          is_active: boolean
          start_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_group_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          start_date?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_group_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          start_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_logs: {
        Row: {
          action: string
          active_user_id: string | null
          created_at: string
          id: string
          impersonation_session_id: string | null
          ip_address: string | null
          real_user_id: string | null
          request_id: string | null
          resource: string
          result: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          active_user_id?: string | null
          created_at?: string
          id?: string
          impersonation_session_id?: string | null
          ip_address?: string | null
          real_user_id?: string | null
          request_id?: string | null
          resource: string
          result: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          active_user_id?: string | null
          created_at?: string
          id?: string
          impersonation_session_id?: string | null
          ip_address?: string | null
          real_user_id?: string | null
          request_id?: string | null
          resource?: string
          result?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_documents: {
        Row: {
          agreement_template_id: string | null
          ativo: boolean
          company_id: string | null
          created_at: string
          data_assinatura: string
          documento_url: string
          employee_id: string
          hash_sha256: string
          id: string
          ip_assinatura: string | null
          metadata: Json | null
          provider_signature_id: string | null
          tenant_id: string
          validation_token: string
          versao: number
        }
        Insert: {
          agreement_template_id?: string | null
          ativo?: boolean
          company_id?: string | null
          created_at?: string
          data_assinatura?: string
          documento_url: string
          employee_id: string
          hash_sha256: string
          id?: string
          ip_assinatura?: string | null
          metadata?: Json | null
          provider_signature_id?: string | null
          tenant_id: string
          validation_token?: string
          versao?: number
        }
        Update: {
          agreement_template_id?: string | null
          ativo?: boolean
          company_id?: string | null
          created_at?: string
          data_assinatura?: string
          documento_url?: string
          employee_id?: string
          hash_sha256?: string
          id?: string
          ip_assinatura?: string | null
          metadata?: Json | null
          provider_signature_id?: string | null
          tenant_id?: string
          validation_token?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "signed_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          new_mrr: number | null
          new_plan: Database["public"]["Enums"]["subscription_plan"] | null
          old_mrr: number | null
          old_plan: Database["public"]["Enums"]["subscription_plan"] | null
          performed_by: string | null
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          new_mrr?: number | null
          new_plan?: Database["public"]["Enums"]["subscription_plan"] | null
          old_mrr?: number | null
          old_plan?: Database["public"]["Enums"]["subscription_plan"] | null
          performed_by?: string | null
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          new_mrr?: number | null
          new_plan?: Database["public"]["Enums"]["subscription_plan"] | null
          old_mrr?: number | null
          old_plan?: Database["public"]["Enums"]["subscription_plan"] | null
          performed_by?: string | null
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_messages: {
        Row: {
          attachments: Json
          created_at: string
          id: string
          message_text: string
          read_at: string | null
          sender_id: string | null
          sender_type: string
          session_id: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          id?: string
          message_text: string
          read_at?: string | null
          sender_id?: string | null
          sender_type: string
          session_id: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          id?: string
          message_text?: string
          read_at?: string | null
          sender_id?: string | null
          sender_type?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_notes: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          is_internal: boolean
          note_text: string
          session_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          note_text: string
          session_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          note_text?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "support_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_sessions: {
        Row: {
          assigned_agent_id: string | null
          closure_category: string | null
          closure_resolved: boolean | null
          closure_summary: string | null
          created_at: string
          ended_at: string | null
          id: string
          module_reference: string | null
          priority: string
          protocol_number: string
          started_at: string
          status: string
          tags: string[]
          tenant_id: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          closure_category?: string | null
          closure_resolved?: boolean | null
          closure_summary?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          module_reference?: string | null
          priority?: string
          protocol_number?: string
          started_at?: string
          status?: string
          tags?: string[]
          tenant_id: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          closure_category?: string | null
          closure_resolved?: boolean | null
          closure_summary?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          module_reference?: string | null
          priority?: string
          protocol_number?: string
          started_at?: string
          status?: string
          tags?: string[]
          tenant_id?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_evaluations: {
        Row: {
          agent_id: string | null
          agent_score: number | null
          comment: string | null
          created_at: string
          id: string
          system_score: number | null
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_score?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          system_score?: number | null
          tenant_id: string
          ticket_id: string
        }
        Update: {
          agent_id?: string | null
          agent_score?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          system_score?: number | null
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_evaluations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_evaluations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_module_versions: {
        Row: {
          created_at: string
          created_by: string | null
          feature_flags: Json
          id: string
          module_id: string
          module_version_id: string | null
          platform_ui_schema: Json
          released_at: string | null
          tenant_ui_schema: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          feature_flags?: Json
          id?: string
          module_id?: string
          module_version_id?: string | null
          platform_ui_schema?: Json
          released_at?: string | null
          tenant_ui_schema?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          feature_flags?: Json
          id?: string
          module_id?: string
          module_version_id?: string | null
          platform_ui_schema?: Json
          released_at?: string | null
          tenant_ui_schema?: Json
        }
        Relationships: [
          {
            foreignKeyName: "support_module_versions_module_version_id_fkey"
            columns: ["module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sandbox_previews: {
        Row: {
          activated_at: string
          activated_by: string
          concluded_at: string | null
          conclusion_notes: string | null
          feature_flags_override: Json
          id: string
          module_id: string
          promoted: boolean
          status: string
          tenant_id: string
          version_id: string
        }
        Insert: {
          activated_at?: string
          activated_by: string
          concluded_at?: string | null
          conclusion_notes?: string | null
          feature_flags_override?: Json
          id?: string
          module_id?: string
          promoted?: boolean
          status?: string
          tenant_id: string
          version_id: string
        }
        Update: {
          activated_at?: string
          activated_by?: string
          concluded_at?: string | null
          conclusion_notes?: string | null
          feature_flags_override?: Json
          id?: string
          module_id?: string
          promoted?: boolean
          status?: string
          tenant_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sandbox_previews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_sandbox_previews_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "support_module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_squad_members: {
        Row: {
          agent_id: string
          id: string
          joined_at: string
          squad_id: string
        }
        Insert: {
          agent_id: string
          id?: string
          joined_at?: string
          squad_id: string
        }
        Update: {
          agent_id?: string
          id?: string
          joined_at?: string
          squad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_squad_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "support_squads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_squads: {
        Row: {
          coordinator_agent_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          coordinator_agent_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          coordinator_agent_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_squads_coordinator_agent_id_fkey"
            columns: ["coordinator_agent_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_system_ratings: {
        Row: {
          category: string
          created_at: string
          feedback: string | null
          id: string
          metadata: Json | null
          rating: number
          tenant_id: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          feedback?: string | null
          id?: string
          metadata?: Json | null
          rating: number
          tenant_id: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          feedback?: string | null
          id?: string
          metadata?: Json | null
          rating?: number
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_system_ratings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          is_internal: boolean
          sender_id: string
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id: string
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["support_sender_type"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["support_ticket_category"]
          closed_at: string | null
          created_at: string
          created_by: string
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_wiki_articles: {
        Row: {
          author_id: string | null
          category_id: string | null
          content_html: string
          content_plain: string | null
          created_at: string
          helpful_count: number
          id: string
          is_featured: boolean
          is_published: boolean
          module_reference: string | null
          not_helpful_count: number
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content_html?: string
          content_plain?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          module_reference?: string | null
          not_helpful_count?: number
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content_html?: string
          content_plain?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          module_reference?: string | null
          not_helpful_count?: number
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_wiki_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "support_wiki_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_wiki_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tax_brackets: {
        Row: {
          bracket_order: number
          created_at: string
          deduction: number
          effective_from: string
          effective_until: string | null
          id: string
          max_value: number | null
          min_value: number
          rate: number
          tax_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bracket_order: number
          created_at?: string
          deduction?: number
          effective_from: string
          effective_until?: string | null
          id?: string
          max_value?: number | null
          min_value: number
          rate: number
          tax_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bracket_order?: number
          created_at?: string
          deduction?: number
          effective_from?: string
          effective_until?: string | null
          id?: string
          max_value?: number | null
          min_value?: number
          rate?: number
          tax_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_brackets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bindings: {
        Row: {
          chat_id: string
          chat_type: string
          created_at: string | null
          created_by: string | null
          employee_id: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          label: string
          metadata: Json | null
          tenant_id: string
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          chat_id: string
          chat_type?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          label?: string
          metadata?: Json | null
          tenant_id: string
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          chat_id?: string
          chat_type?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          label?: string
          metadata?: Json | null
          tenant_id?: string
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bindings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_bindings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_configs: {
        Row: {
          bot_token_encrypted: string | null
          bot_username: string | null
          connection_status: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          is_active: boolean | null
          last_verified_at: string | null
          tenant_id: string
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          bot_token_encrypted?: string | null
          bot_username?: string | null
          connection_status?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          tenant_id: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          bot_token_encrypted?: string | null
          bot_username?: string | null
          connection_status?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          tenant_id?: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_message_queue: {
        Row: {
          attempts: number | null
          binding_id: string | null
          chat_id: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          message_text: string
          metadata: Json | null
          parse_mode: string | null
          priority: number | null
          processed_at: string | null
          scheduled_at: string | null
          status: string | null
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          attempts?: number | null
          binding_id?: string | null
          chat_id: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message_text: string
          metadata?: Json | null
          parse_mode?: string | null
          priority?: number | null
          processed_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          attempts?: number | null
          binding_id?: string | null
          chat_id?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message_text?: string
          metadata?: Json | null
          parse_mode?: string | null
          priority?: number | null
          processed_at?: string | null
          scheduled_at?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_message_queue_binding_id_fkey"
            columns: ["binding_id"]
            isOneToOne: false
            referencedRelation: "telegram_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_message_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "telegram_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_message_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          event_label: string
          event_type: string
          id: string
          is_enabled: boolean | null
          parse_mode: string | null
          template_text: string
          tenant_id: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          event_label?: string
          event_type: string
          id?: string
          is_enabled?: boolean | null
          parse_mode?: string | null
          template_text?: string
          tenant_id: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          event_label?: string
          event_type?: string
          id?: string
          is_enabled?: boolean | null
          parse_mode?: string | null
          template_text?: string
          tenant_id?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_webhook_logs: {
        Row: {
          chat_id: string | null
          command: string | null
          created_at: string | null
          from_username: string | null
          id: string
          message_text: string | null
          processed: boolean | null
          raw_payload: Json | null
          response_sent: string | null
          tenant_id: string
          update_id: number | null
        }
        Insert: {
          chat_id?: string | null
          command?: string | null
          created_at?: string | null
          from_username?: string | null
          id?: string
          message_text?: string | null
          processed?: boolean | null
          raw_payload?: Json | null
          response_sent?: string | null
          tenant_id: string
          update_id?: number | null
        }
        Update: {
          chat_id?: string | null
          command?: string | null
          created_at?: string | null
          from_username?: string | null
          id?: string
          message_text?: string | null
          processed?: boolean | null
          raw_payload?: Json | null
          response_sent?: string | null
          tenant_id?: string
          update_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_announcements: {
        Row: {
          action_url: string | null
          alert_type: string
          blocking_level: string
          created_at: string
          created_by: string | null
          end_at: string | null
          id: string
          is_dismissible: boolean
          message: string
          severity: string
          source: string
          start_at: string
          target_feature_flag: string | null
          target_plan_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          alert_type?: string
          blocking_level?: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          id?: string
          is_dismissible?: boolean
          message: string
          severity?: string
          source?: string
          start_at?: string
          target_feature_flag?: string | null
          target_plan_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          alert_type?: string
          blocking_level?: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          id?: string
          is_dismissible?: boolean
          message?: string
          severity?: string
          source?: string
          start_at?: string
          target_feature_flag?: string | null
          target_plan_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_event_consumer_offsets: {
        Row: {
          consumer_group: string
          id: string
          last_consumed_at: string
          last_sequence_num: number
          tenant_id: string
          topic: string
        }
        Insert: {
          consumer_group: string
          id?: string
          last_consumed_at?: string
          last_sequence_num?: number
          tenant_id: string
          topic: string
        }
        Update: {
          consumer_group?: string
          id?: string
          last_consumed_at?: string
          last_sequence_num?: number
          tenant_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_event_consumer_offsets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_event_dlq: {
        Row: {
          created_at: string
          error_message: string
          error_stack: string | null
          event_type: string
          failed_at: string
          id: string
          metadata: Json | null
          original_event_id: string | null
          payload: Json
          reprocessed: boolean
          reprocessed_at: string | null
          retry_count: number
          tenant_id: string
          topic: string
        }
        Insert: {
          created_at?: string
          error_message: string
          error_stack?: string | null
          event_type: string
          failed_at?: string
          id?: string
          metadata?: Json | null
          original_event_id?: string | null
          payload: Json
          reprocessed?: boolean
          reprocessed_at?: string | null
          retry_count?: number
          tenant_id: string
          topic: string
        }
        Update: {
          created_at?: string
          error_message?: string
          error_stack?: string | null
          event_type?: string
          failed_at?: string
          id?: string
          metadata?: Json | null
          original_event_id?: string | null
          payload?: Json
          reprocessed?: boolean
          reprocessed_at?: string | null
          retry_count?: number
          tenant_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_event_dlq_original_event_id_fkey"
            columns: ["original_event_id"]
            isOneToOne: false
            referencedRelation: "tenant_event_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_event_dlq_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_event_log: {
        Row: {
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          expires_at: string
          id: string
          max_retries: number
          metadata: Json | null
          next_retry_at: string | null
          partition_key: string
          payload: Json
          priority: number
          processed_at: string | null
          retry_count: number
          sequence_num: number
          source: string
          status: string
          tenant_id: string
          topic: string
        }
        Insert: {
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          expires_at?: string
          id?: string
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          partition_key: string
          payload?: Json
          priority?: number
          processed_at?: string | null
          retry_count?: number
          sequence_num?: number
          source?: string
          status?: string
          tenant_id: string
          topic: string
        }
        Update: {
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          expires_at?: string
          id?: string
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          partition_key?: string
          payload?: Json
          priority?: number
          processed_at?: string | null
          retry_count?: number
          sequence_num?: number
          source?: string
          status?: string
          tenant_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_event_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_module_access: {
        Row: {
          access_source: string
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          module_key: string
          tenant_id: string
        }
        Insert: {
          access_source?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          module_key: string
          tenant_id: string
        }
        Update: {
          access_source?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          module_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_module_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          activated_at: string
          activated_by: string | null
          created_at: string
          deactivated_at: string | null
          id: string
          is_active: boolean
          module_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          module_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          module_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_plans: {
        Row: {
          activated_by: string | null
          billing_cycle: string
          created_at: string
          expires_at: string | null
          id: string
          next_billing_date: string | null
          payment_method: string | null
          plan_id: string
          started_at: string
          status: string
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          activated_by?: string | null
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          next_billing_date?: string | null
          payment_method?: string | null
          plan_id: string
          started_at?: string
          status?: string
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_by?: string | null
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          next_billing_date?: string | null
          payment_method?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          churned_at: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          mrr: number
          next_billing_at: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          seats_included: number
          seats_used: number
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          churned_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          mrr?: number
          next_billing_at?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          seats_included?: number
          seats_used?: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          churned_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          mrr?: number
          next_billing_at?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          seats_included?: number
          seats_used?: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          scheduled_deletion_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          scheduled_deletion_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          scheduled_deletion_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_audit_logs: {
        Row: {
          action: string
          created_at: string
          employee_id: string
          id: string
          metadata: Json | null
          nr_codigo: number
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          employee_id: string
          id?: string
          metadata?: Json | null
          nr_codigo: number
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          employee_id?: string
          id?: string
          metadata?: Json | null
          nr_codigo?: number
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_requirements: {
        Row: {
          catalog_item_id: string
          cbo_codigo: string
          company_group_id: string | null
          company_id: string
          condicional_por_risco: boolean
          created_at: string
          deleted_at: string | null
          grau_risco_minimo: number
          id: string
          nr_codigo: number
          obrigatorio: boolean
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          catalog_item_id: string
          cbo_codigo: string
          company_group_id?: string | null
          company_id: string
          condicional_por_risco?: boolean
          created_at?: string
          deleted_at?: string | null
          grau_risco_minimo?: number
          id?: string
          nr_codigo: number
          obrigatorio?: boolean
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string
          cbo_codigo?: string
          company_group_id?: string | null
          company_id?: string
          condicional_por_risco?: boolean
          created_at?: string
          deleted_at?: string | null
          grau_risco_minimo?: number
          id?: string
          nr_codigo?: number
          obrigatorio?: boolean
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_requirements_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "nr_training_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_requirements_company_group_id_fkey"
            columns: ["company_group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_requirements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_pricing_tiers: {
        Row: {
          created_at: string
          flat_fee_brl: number
          id: string
          included_quantity: number
          is_active: boolean
          metric_key: string
          metric_type: string
          module_id: string | null
          overage_price: number
          plan_id: string
          price_per_unit: number
          pricing_model: string
          tier_end: number | null
          tier_start: number
          unit_price_brl: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          flat_fee_brl?: number
          id?: string
          included_quantity?: number
          is_active?: boolean
          metric_key: string
          metric_type?: string
          module_id?: string | null
          overage_price?: number
          plan_id: string
          price_per_unit?: number
          pricing_model?: string
          tier_end?: number | null
          tier_start?: number
          unit_price_brl?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          flat_fee_brl?: number
          id?: string
          included_quantity?: number
          is_active?: boolean
          metric_key?: string
          metric_type?: string
          module_id?: string | null
          overage_price?: number
          plan_id?: string
          price_per_unit?: number
          pricing_model?: string
          tier_end?: number | null
          tier_start?: number
          unit_price_brl?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_pricing_tiers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string
          id: string
          metadata: Json | null
          metric_key: string
          metric_type: string
          module_id: string | null
          quantity: number
          recorded_at: string
          source: string
          tenant_id: string
          unit: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_key: string
          metric_type?: string
          module_id?: string | null
          quantity?: number
          recorded_at?: string
          source?: string
          tenant_id: string
          unit?: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_key?: string
          metric_type?: string
          module_id?: string | null
          quantity?: number
          recorded_at?: string
          source?: string
          tenant_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["permission_scope"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["permission_scope"]
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["permission_scope"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          scope_id: string | null
          scope_type: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          scope_id?: string | null
          scope_type?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          scope_id?: string | null
          scope_type?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      versioning_releases: {
        Row: {
          changelog_entries: string[]
          created_at: string
          created_by: string
          dependency_snapshot: Json
          finalized_at: string | null
          finalized_by: string | null
          id: string
          module_versions: string[]
          name: string
          platform_version_id: string | null
          pre_checks: Json
          promoted_to_candidate_at: string | null
          promoted_to_candidate_by: string | null
          rollback_reason: string | null
          rolled_back_at: string | null
          status: string
        }
        Insert: {
          changelog_entries?: string[]
          created_at?: string
          created_by: string
          dependency_snapshot?: Json
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          module_versions?: string[]
          name: string
          platform_version_id?: string | null
          pre_checks?: Json
          promoted_to_candidate_at?: string | null
          promoted_to_candidate_by?: string | null
          rollback_reason?: string | null
          rolled_back_at?: string | null
          status?: string
        }
        Update: {
          changelog_entries?: string[]
          created_at?: string
          created_by?: string
          dependency_snapshot?: Json
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          module_versions?: string[]
          name?: string
          platform_version_id?: string | null
          pre_checks?: Json
          promoted_to_candidate_at?: string | null
          promoted_to_candidate_by?: string | null
          rollback_reason?: string | null
          rolled_back_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "versioning_releases_platform_version_id_fkey"
            columns: ["platform_version_id"]
            isOneToOne: false
            referencedRelation: "platform_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configurations: {
        Row: {
          created_at: string
          description: string | null
          headers: Json | null
          id: string
          is_active: boolean
          provider: string | null
          retry_count: number | null
          secret_encrypted: string | null
          tenant_id: string
          timeout_seconds: number | null
          updated_at: string
          webhook_name: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          headers?: Json | null
          id?: string
          is_active?: boolean
          provider?: string | null
          retry_count?: number | null
          secret_encrypted?: string | null
          tenant_id: string
          timeout_seconds?: number | null
          updated_at?: string
          webhook_name: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          headers?: Json | null
          id?: string
          is_active?: boolean
          provider?: string | null
          retry_count?: number | null
          secret_encrypted?: string | null
          tenant_id?: string
          timeout_seconds?: number | null
          updated_at?: string
          webhook_name?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_pages: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_visible: boolean
          layout_schema: Json
          name: string
          parent_id: string | null
          published_at: string | null
          seo_config: Json
          slug: string
          sort_order: number
          status: string
          tenant_id: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_visible?: boolean
          layout_schema?: Json
          name: string
          parent_id?: string | null
          published_at?: string | null
          seo_config?: Json
          slug: string
          sort_order?: number
          status?: string
          tenant_id: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_visible?: boolean
          layout_schema?: Json
          name?: string
          parent_id?: string | null
          published_at?: string | null
          seo_config?: Json
          slug?: string
          sort_order?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_versions: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          notes: string | null
          published_by: string | null
          published_by_email: string | null
          snapshot_content: Json
          snapshot_layout: Json
          snapshot_seo: Json
          version_number: number
          website_page_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          notes?: string | null
          published_by?: string | null
          published_by_email?: string | null
          snapshot_content?: Json
          snapshot_layout?: Json
          snapshot_seo?: Json
          version_number?: number
          website_page_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          notes?: string | null
          published_by?: string | null
          published_by_email?: string | null
          snapshot_content?: Json
          snapshot_layout?: Json
          snapshot_seo?: Json
          version_number?: number
          website_page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_versions_website_page_id_fkey"
            columns: ["website_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          published_at: string | null
          status: string
          theme: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          published_at?: string | null
          status?: string
          theme?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          published_at?: string | null
          status?: string
          theme?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      white_label_config: {
        Row: {
          cloudflare_api_token: string
          cloudflare_zone_id: string
          created_at: string
          domain_principal: string
          id: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          cloudflare_api_token: string
          cloudflare_zone_id: string
          created_at?: string
          domain_principal: string
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          cloudflare_api_token?: string
          cloudflare_zone_id?: string
          created_at?: string
          domain_principal?: string
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "white_label_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_insights: {
        Row: {
          company_id: string | null
          criado_em: string
          dados_origem_json: Json | null
          descricao: string
          group_id: string | null
          id: string
          insight_type: string
          severity: string
          tenant_id: string
        }
        Insert: {
          company_id?: string | null
          criado_em?: string
          dados_origem_json?: Json | null
          descricao: string
          group_id?: string | null
          id?: string
          insight_type: string
          severity?: string
          tenant_id: string
        }
        Update: {
          company_id?: string | null
          criado_em?: string
          dados_origem_json?: Json | null
          descricao?: string
          group_id?: string | null
          id?: string
          insight_type?: string
          severity?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_insights_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "company_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pcmso_exam_alerts: {
        Row: {
          alert_status: string | null
          company_id: string | null
          days_until_due: number | null
          employee_id: string | null
          employee_name: string | null
          exam_date: string | null
          exam_id: string | null
          exam_type: Database["public"]["Enums"]["exam_type"] | null
          health_program_id: string | null
          next_exam_date: string | null
          program_name: string | null
          result: Database["public"]["Enums"]["exam_result"] | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_health_exams_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_health_exams_health_program_id_fkey"
            columns: ["health_program_id"]
            isOneToOne: false
            referencedRelation: "health_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_health_exams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_payroll_simulation: {
        Args: {
          _base_salary: number
          _reference_date?: string
          _tenant_id: string
        }
        Returns: Json
      }
      can_manage_compensation: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_employees: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_employees_scoped: {
        Args: {
          _company_group_id?: string
          _company_id?: string
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_view_compensation: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_compensation_scoped: {
        Args: {
          _company_group_id?: string
          _company_id?: string
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_view_salary_history: {
        Args: {
          _company_group_id?: string
          _company_id?: string
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      check_tenant_needs_onboarding: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      claim_invited_memberships: {
        Args: { p_email: string; p_user_id: string }
        Returns: string[]
      }
      cleanup_expired_display_events: { Args: never; Returns: number }
      cleanup_expired_events: { Args: never; Returns: number }
      cleanup_old_display_logs: { Args: never; Returns: undefined }
      compute_risk_heatmap: {
        Args: {
          p_days_back?: number
          p_grid_size?: number
          p_lat_max?: number
          p_lat_min?: number
          p_lng_max?: number
          p_lng_min?: number
          p_tenant_id: string
        }
        Returns: Json
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      expire_inactive_display_sessions: { Args: never; Returns: number }
      fn_regulatory_audit_insert: {
        Args: {
          _actor_id: string
          _actor_role: string
          _dados_antes?: Json
          _dados_depois?: Json
          _descricao: string
          _document_code: string
          _entity_id: string
          _entity_type: string
          _event_type: string
          _metadata?: Json
          _tenant_id: string
        }
        Returns: string
      }
      generate_billing_alerts: { Args: never; Returns: undefined }
      generate_support_protocol: { Args: never; Returns: string }
      get_cognitive_event_stats: { Args: { days_back?: number }; Returns: Json }
      get_coordinator_squad_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_epi_assets_in_use: {
        Args: { _tenant_id: string }
        Returns: {
          asset_id: string
          data_entrega: string
          employee_id: string
          employee_name: string
          epi_nome: string
          serial_number: string
        }[]
      }
      get_epi_cost_by_department: {
        Args: { _months?: number; _tenant_id: string }
        Returns: {
          custo_total: number
          department_id: string
          department_name: string
          mes: string
          quantidade: number
        }[]
      }
      get_epi_cost_by_employee: {
        Args: { _employee_id: string; _tenant_id: string }
        Returns: {
          custo_total_acumulado: number
          epi_nome: string
          total_quantidade: number
        }[]
      }
      get_epi_cost_ranking_by_company: {
        Args: { _tenant_id: string }
        Returns: {
          company_id: string
          company_name: string
          custo_total: number
          total_colaboradores: number
          total_itens: number
        }[]
      }
      get_epi_cost_summary_by_company: {
        Args: {
          _company_id: string
          _period_from?: string
          _period_to?: string
          _tenant_id: string
        }
        Returns: {
          centro_custo: string
          employee_id: string
          employee_name: string
          total_epi_cost: number
          total_items: number
        }[]
      }
      get_epi_inventory_summary: {
        Args: { _tenant_id: string; _warehouse_id?: string }
        Returns: {
          custo_unitario_medio: number
          epi_catalog_id: string
          epi_nome: string
          last_movement_at: string
          quantidade_disponivel: number
          quantidade_minima: number
          quantidade_reservada: number
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      get_epi_lots_by_expiry: {
        Args: { _tenant_id: string }
        Returns: {
          status: string
          total: number
        }[]
      }
      get_epi_stock_rupture_risk: {
        Args: { _tenant_id: string }
        Returns: {
          dias_cobertura: number
          epi_nome: string
          inventory_id: string
          quantidade_disponivel: number
          quantidade_minima: number
          risco: string
          warehouse_name: string
        }[]
      }
      get_pccs_dashboard_stats: { Args: { p_tenant_id: string }; Returns: Json }
      get_platform_extended_metrics: { Args: never; Returns: Json }
      get_platform_metrics: { Args: never; Returns: Json }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_type_from_jwt: { Args: never; Returns: string }
      get_webhook_secret: { Args: { _webhook_id: string }; Returns: string }
      has_platform_financial_read_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_platform_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_referral_link_conversions: {
        Args: { link_id: string }
        Returns: undefined
      }
      increment_referral_link_signups: {
        Args: { link_id: string }
        Returns: undefined
      }
      insert_legal_interpretation_log: {
        Args: {
          p_acoes_geradas: Json
          p_impacto: Json
          p_modelo_utilizado?: string
          p_mudanca_id: string
          p_norm_codigo: string
          p_resumo: string
          p_risco_nivel?: string
          p_tenant_id: string
        }
        Returns: string
      }
      is_active_platform_user: { Args: { _user_id: string }; Returns: boolean }
      is_platform_billing_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_platform_user: { Args: { _user_id: string }; Returns: boolean }
      is_squad_coordinator: {
        Args: { _squad_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_superadmin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      log_safety_automation_action: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_executor?: string
          p_metadata?: Json
          p_tenant_id: string
          p_workflow_id: string
        }
        Returns: string
      }
      platform_create_tenant: {
        Args: {
          p_admin_email?: string
          p_admin_name?: string
          p_document?: string
          p_email?: string
          p_name: string
          p_phone?: string
        }
        Returns: Json
      }
      purge_old_cognitive_events: { Args: never; Returns: undefined }
      scan_employee_compliance: {
        Args: { _tenant_id: string }
        Returns: {
          company_id: string
          description: string
          employee_id: string
          employee_name: string
          severity: string
          violation_type: string
        }[]
      }
      scan_expired_epis: {
        Args: { _tenant_id: string }
        Returns: {
          data_validade: string
          delivery_id: string
          dias_vencido: number
          employee_id: string
          employee_name: string
          epi_nome: string
        }[]
      }
      scan_expiring_epi_lots: {
        Args: { _days_ahead?: number; _tenant_id: string }
        Returns: {
          dias_restantes: number
          epi_nome: string
          lot_id: string
          lote_numero: string
          lote_validade: string
          quantidade_em_estoque: number
        }[]
      }
      schedule_event_retry: {
        Args: { p_error_message?: string; p_event_id: string }
        Returns: string
      }
      seed_default_labor_rules: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      seed_default_rubrics: { Args: { _tenant_id: string }; Returns: undefined }
      seed_esocial_mappings: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      seed_nr_training_catalog: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      seed_salary_rubric_templates: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      self_register_tenant: {
        Args: {
          p_company_document?: string
          p_company_name: string
          p_company_phone?: string
          p_user_email: string
          p_user_id: string
          p_user_name: string
        }
        Returns: Json
      }
      set_webhook_secret: {
        Args: { _secret: string; _webhook_id: string }
        Returns: undefined
      }
      sync_experience_profile: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      sync_tenant_module_access: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      user_can_see_notification: {
        Args: {
          _company_id: string
          _group_id: string
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      user_has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["tenant_role"][]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      user_has_company_access: {
        Args: { _company_id: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_group_access: {
        Args: { _group_id: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      user_has_tenant_access: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_admin_or_hr: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_company_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_employee: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_group_admin: {
        Args: { _group_id: string; _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      announcement_category:
        | "maintenance"
        | "update"
        | "billing"
        | "security"
        | "compliance"
        | "general"
      announcement_priority: "low" | "medium" | "high" | "critical"
      assist_mode: "silent" | "visible"
      benefit_type: "va" | "vr" | "vt" | "health" | "dental" | "cesta" | "flex"
      compliance_rule_severity: "info" | "warning" | "critical"
      compliance_rule_status: "active" | "disabled" | "archived"
      contract_type:
        | "clt_indeterminado"
        | "clt_determinado"
        | "clt_intermitente"
        | "clt_temporario"
        | "clt_aprendiz"
        | "estagio"
        | "autonomo"
      display_board_tipo: "fleet" | "sst" | "compliance" | "executivo"
      display_session_status: "pending" | "active" | "expired"
      display_status: "active" | "paused" | "disconnected" | "offline"
      employee_dependent_type:
        | "conjuge"
        | "filho"
        | "enteado"
        | "pai_mae"
        | "tutelado"
        | "outros"
      employee_document_type:
        | "rg"
        | "ctps"
        | "pis_pasep"
        | "titulo_eleitor"
        | "cnh"
        | "certidao_nascimento"
        | "certidao_casamento"
        | "reservista"
        | "passaporte"
        | "crnm"
        | "outros"
      employee_estado_civil:
        | "solteiro"
        | "casado"
        | "divorciado"
        | "viuvo"
        | "separado"
        | "uniao_estavel"
        | "nao_informado"
      employee_event_type:
        | "company_transfer"
        | "position_change"
        | "department_change"
        | "status_change"
        | "manager_change"
        | "salary_change"
        | "employee_hired"
        | "salary_contract_started"
        | "salary_adjusted"
        | "additional_added"
        | "job_changed"
      employee_record_status:
        | "pre_admissao"
        | "ativo"
        | "afastado"
        | "desligado"
      employee_sexo: "masculino" | "feminino" | "intersexo" | "nao_informado"
      employee_status: "active" | "inactive" | "on_leave"
      esocial_category:
        | "101"
        | "102"
        | "103"
        | "104"
        | "105"
        | "106"
        | "107"
        | "108"
        | "111"
        | "201"
        | "202"
        | "301"
        | "302"
        | "303"
        | "304"
        | "305"
        | "306"
        | "401"
        | "410"
        | "501"
        | "701"
        | "711"
        | "712"
        | "721"
        | "722"
        | "723"
        | "731"
        | "734"
        | "738"
        | "741"
        | "751"
        | "761"
        | "771"
        | "781"
        | "901"
        | "902"
      esocial_event_category:
        | "tabelas"
        | "nao_periodicos"
        | "periodicos"
        | "sst"
        | "gfip_fgts"
      esocial_event_status:
        | "pending"
        | "processing"
        | "sent"
        | "accepted"
        | "rejected"
        | "error"
        | "cancelled"
      exam_result: "apto" | "inapto" | "apto_restricao"
      exam_type:
        | "admissional"
        | "periodico"
        | "demissional"
        | "mudanca_funcao"
        | "retorno_trabalho"
      fgts_regime: "optante" | "nao_optante" | "retroativo"
      forma_pagamento: "deposito_bancario" | "pix" | "cheque" | "dinheiro"
      health_program_type: "pcmso" | "pgr" | "ltcat" | "ppra"
      jornada_tipo: "integral" | "parcial" | "escala" | "12x36" | "flexivel"
      labor_rule_calc_type:
        | "percentage"
        | "fixed_value"
        | "tiered"
        | "formula"
        | "reference_table"
      labor_rule_category:
        | "hora_extra"
        | "adicional_noturno"
        | "insalubridade"
        | "periculosidade"
        | "sobreaviso"
        | "plantao"
        | "intervalo_intrajornada"
        | "dsr"
        | "ferias"
        | "decimo_terceiro"
        | "aviso_previo"
        | "fgts"
        | "contribuicao_sindical"
        | "vale_transporte"
        | "salario_familia"
        | "licenca_maternidade"
        | "licenca_paternidade"
        | "piso_salarial"
        | "reajuste_anual"
        | "banco_horas"
        | "custom"
      notification_type: "info" | "warning" | "critical" | "success"
      payroll_incidence:
        | "inss"
        | "irrf"
        | "fgts"
        | "inss_irrf"
        | "inss_fgts"
        | "irrf_fgts"
        | "all"
        | "none"
      payroll_item_nature: "fixed" | "variable" | "informational"
      payroll_item_type: "provento" | "desconto"
      permission_scope: "tenant" | "company_group" | "company"
      platform_role:
        | "platform_super_admin"
        | "platform_support"
        | "platform_finance"
        | "platform_operations"
        | "platform_read_only"
        | "platform_fiscal"
        | "platform_marketing_team"
        | "platform_marketing_director"
        | "platform_support_agent"
        | "platform_support_manager"
        | "platform_support_coordinator"
      risk_category:
        | "fisico"
        | "quimico"
        | "biologico"
        | "ergonomico"
        | "acidente"
      rubric_base_calculo: "salario_base" | "percentual" | "manual"
      safety_workflow_priority: "low" | "medium" | "high" | "critical"
      safety_workflow_status: "open" | "in_progress" | "resolved" | "cancelled"
      safety_workflow_type:
        | "nr_expirada"
        | "exame_vencido"
        | "risco_critico"
        | "falta_epi"
        | "treinamento_obrigatorio"
      salary_additional_type:
        | "bonus"
        | "commission"
        | "allowance"
        | "hazard_pay"
        | "overtime"
        | "other"
      salary_adjustment_type:
        | "annual"
        | "promotion"
        | "adjustment"
        | "merit"
        | "correction"
      subscription_plan: "starter" | "professional" | "enterprise" | "custom"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "cancelled"
        | "churned"
      support_sender_type: "tenant_user" | "platform_agent" | "system"
      support_ticket_category:
        | "billing"
        | "technical"
        | "feature_request"
        | "bug_report"
        | "account"
        | "general"
      support_ticket_priority: "low" | "medium" | "high" | "urgent"
      support_ticket_status:
        | "open"
        | "awaiting_agent"
        | "awaiting_customer"
        | "in_progress"
        | "resolved"
        | "closed"
        | "cancelled"
      tenant_role:
        | "owner"
        | "admin"
        | "manager"
        | "viewer"
        | "superadmin"
        | "tenant_admin"
        | "group_admin"
        | "company_admin"
        | "rh"
        | "gestor"
        | "financeiro"
      tipo_salario: "mensalista" | "horista"
      work_regime:
        | "clt"
        | "estatutario"
        | "temporario"
        | "avulso"
        | "cooperado"
        | "estagiario"
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
      announcement_category: [
        "maintenance",
        "update",
        "billing",
        "security",
        "compliance",
        "general",
      ],
      announcement_priority: ["low", "medium", "high", "critical"],
      assist_mode: ["silent", "visible"],
      benefit_type: ["va", "vr", "vt", "health", "dental", "cesta", "flex"],
      compliance_rule_severity: ["info", "warning", "critical"],
      compliance_rule_status: ["active", "disabled", "archived"],
      contract_type: [
        "clt_indeterminado",
        "clt_determinado",
        "clt_intermitente",
        "clt_temporario",
        "clt_aprendiz",
        "estagio",
        "autonomo",
      ],
      display_board_tipo: ["fleet", "sst", "compliance", "executivo"],
      display_session_status: ["pending", "active", "expired"],
      display_status: ["active", "paused", "disconnected", "offline"],
      employee_dependent_type: [
        "conjuge",
        "filho",
        "enteado",
        "pai_mae",
        "tutelado",
        "outros",
      ],
      employee_document_type: [
        "rg",
        "ctps",
        "pis_pasep",
        "titulo_eleitor",
        "cnh",
        "certidao_nascimento",
        "certidao_casamento",
        "reservista",
        "passaporte",
        "crnm",
        "outros",
      ],
      employee_estado_civil: [
        "solteiro",
        "casado",
        "divorciado",
        "viuvo",
        "separado",
        "uniao_estavel",
        "nao_informado",
      ],
      employee_event_type: [
        "company_transfer",
        "position_change",
        "department_change",
        "status_change",
        "manager_change",
        "salary_change",
        "employee_hired",
        "salary_contract_started",
        "salary_adjusted",
        "additional_added",
        "job_changed",
      ],
      employee_record_status: [
        "pre_admissao",
        "ativo",
        "afastado",
        "desligado",
      ],
      employee_sexo: ["masculino", "feminino", "intersexo", "nao_informado"],
      employee_status: ["active", "inactive", "on_leave"],
      esocial_category: [
        "101",
        "102",
        "103",
        "104",
        "105",
        "106",
        "107",
        "108",
        "111",
        "201",
        "202",
        "301",
        "302",
        "303",
        "304",
        "305",
        "306",
        "401",
        "410",
        "501",
        "701",
        "711",
        "712",
        "721",
        "722",
        "723",
        "731",
        "734",
        "738",
        "741",
        "751",
        "761",
        "771",
        "781",
        "901",
        "902",
      ],
      esocial_event_category: [
        "tabelas",
        "nao_periodicos",
        "periodicos",
        "sst",
        "gfip_fgts",
      ],
      esocial_event_status: [
        "pending",
        "processing",
        "sent",
        "accepted",
        "rejected",
        "error",
        "cancelled",
      ],
      exam_result: ["apto", "inapto", "apto_restricao"],
      exam_type: [
        "admissional",
        "periodico",
        "demissional",
        "mudanca_funcao",
        "retorno_trabalho",
      ],
      fgts_regime: ["optante", "nao_optante", "retroativo"],
      forma_pagamento: ["deposito_bancario", "pix", "cheque", "dinheiro"],
      health_program_type: ["pcmso", "pgr", "ltcat", "ppra"],
      jornada_tipo: ["integral", "parcial", "escala", "12x36", "flexivel"],
      labor_rule_calc_type: [
        "percentage",
        "fixed_value",
        "tiered",
        "formula",
        "reference_table",
      ],
      labor_rule_category: [
        "hora_extra",
        "adicional_noturno",
        "insalubridade",
        "periculosidade",
        "sobreaviso",
        "plantao",
        "intervalo_intrajornada",
        "dsr",
        "ferias",
        "decimo_terceiro",
        "aviso_previo",
        "fgts",
        "contribuicao_sindical",
        "vale_transporte",
        "salario_familia",
        "licenca_maternidade",
        "licenca_paternidade",
        "piso_salarial",
        "reajuste_anual",
        "banco_horas",
        "custom",
      ],
      notification_type: ["info", "warning", "critical", "success"],
      payroll_incidence: [
        "inss",
        "irrf",
        "fgts",
        "inss_irrf",
        "inss_fgts",
        "irrf_fgts",
        "all",
        "none",
      ],
      payroll_item_nature: ["fixed", "variable", "informational"],
      payroll_item_type: ["provento", "desconto"],
      permission_scope: ["tenant", "company_group", "company"],
      platform_role: [
        "platform_super_admin",
        "platform_support",
        "platform_finance",
        "platform_operations",
        "platform_read_only",
        "platform_fiscal",
        "platform_marketing_team",
        "platform_marketing_director",
        "platform_support_agent",
        "platform_support_manager",
        "platform_support_coordinator",
      ],
      risk_category: [
        "fisico",
        "quimico",
        "biologico",
        "ergonomico",
        "acidente",
      ],
      rubric_base_calculo: ["salario_base", "percentual", "manual"],
      safety_workflow_priority: ["low", "medium", "high", "critical"],
      safety_workflow_status: ["open", "in_progress", "resolved", "cancelled"],
      safety_workflow_type: [
        "nr_expirada",
        "exame_vencido",
        "risco_critico",
        "falta_epi",
        "treinamento_obrigatorio",
      ],
      salary_additional_type: [
        "bonus",
        "commission",
        "allowance",
        "hazard_pay",
        "overtime",
        "other",
      ],
      salary_adjustment_type: [
        "annual",
        "promotion",
        "adjustment",
        "merit",
        "correction",
      ],
      subscription_plan: ["starter", "professional", "enterprise", "custom"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "cancelled",
        "churned",
      ],
      support_sender_type: ["tenant_user", "platform_agent", "system"],
      support_ticket_category: [
        "billing",
        "technical",
        "feature_request",
        "bug_report",
        "account",
        "general",
      ],
      support_ticket_priority: ["low", "medium", "high", "urgent"],
      support_ticket_status: [
        "open",
        "awaiting_agent",
        "awaiting_customer",
        "in_progress",
        "resolved",
        "closed",
        "cancelled",
      ],
      tenant_role: [
        "owner",
        "admin",
        "manager",
        "viewer",
        "superadmin",
        "tenant_admin",
        "group_admin",
        "company_admin",
        "rh",
        "gestor",
        "financeiro",
      ],
      tipo_salario: ["mensalista", "horista"],
      work_regime: [
        "clt",
        "estatutario",
        "temporario",
        "avulso",
        "cooperado",
        "estagiario",
      ],
    },
  },
} as const
