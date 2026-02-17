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
      agreement_template_versions: {
        Row: {
          change_summary: string | null
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
          company_group_id: string | null
          company_id: string | null
          conteudo_html: string
          created_at: string
          deleted_at: string | null
          description: string | null
          expiry_days: number | null
          id: string
          is_active: boolean
          is_mandatory: boolean
          name: string
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
          company_group_id?: string | null
          company_id?: string | null
          conteudo_html?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name: string
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
          company_group_id?: string | null
          company_id?: string | null
          conteudo_html?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name?: string
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
          nome_documento: string
          tenant_id: string
          tipo_documento: string
          updated_at: string
          url_arquivo: string
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
          nome_documento: string
          tenant_id: string
          tipo_documento?: string
          updated_at?: string
          url_arquivo: string
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
          nome_documento?: string
          tenant_id?: string
          tipo_documento?: string
          updated_at?: string
          url_arquivo?: string
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
      landing_pages: {
        Row: {
          analytics: Json
          blocks: Json
          created_at: string
          created_by: string | null
          gtm_container_id: string | null
          id: string
          name: string
          published_at: string | null
          referral_program_id: string | null
          slug: string
          status: string
          target_plan_id: string | null
          updated_at: string
        }
        Insert: {
          analytics?: Json
          blocks?: Json
          created_at?: string
          created_by?: string | null
          gtm_container_id?: string | null
          id?: string
          name: string
          published_at?: string | null
          referral_program_id?: string | null
          slug: string
          status?: string
          target_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          analytics?: Json
          blocks?: Json
          created_at?: string
          created_by?: string | null
          gtm_container_id?: string | null
          id?: string
          name?: string
          published_at?: string | null
          referral_program_id?: string | null
          slug?: string
          status?: string
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
      positions: {
        Row: {
          base_salary: number | null
          cbo_code: string | null
          company_group_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          level: string | null
          max_salary: number | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          base_salary?: number | null
          cbo_code?: string | null
          company_group_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: string | null
          max_salary?: number | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          base_salary?: number | null
          cbo_code?: string | null
          company_group_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: string | null
          max_salary?: number | null
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
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
      tenant_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id?: string
          user_id?: string
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
      check_tenant_needs_onboarding: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      generate_billing_alerts: { Args: never; Returns: undefined }
      get_cognitive_event_stats: { Args: { days_back?: number }; Returns: Json }
      get_platform_metrics: { Args: never; Returns: Json }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_type_from_jwt: { Args: never; Returns: string }
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
      is_active_platform_user: { Args: { _user_id: string }; Returns: boolean }
      is_platform_billing_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_platform_user: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
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
      benefit_type: "va" | "vr" | "vt" | "health" | "dental" | "cesta" | "flex"
      compliance_rule_severity: "info" | "warning" | "critical"
      compliance_rule_status: "active" | "disabled" | "archived"
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
      employee_status: "active" | "inactive" | "on_leave"
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
      health_program_type: "pcmso" | "pgr" | "ltcat" | "ppra"
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
      risk_category:
        | "fisico"
        | "quimico"
        | "biologico"
        | "ergonomico"
        | "acidente"
      rubric_base_calculo: "salario_base" | "percentual" | "manual"
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
      benefit_type: ["va", "vr", "vt", "health", "dental", "cesta", "flex"],
      compliance_rule_severity: ["info", "warning", "critical"],
      compliance_rule_status: ["active", "disabled", "archived"],
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
      employee_status: ["active", "inactive", "on_leave"],
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
      health_program_type: ["pcmso", "pgr", "ltcat", "ppra"],
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
      ],
      risk_category: [
        "fisico",
        "quimico",
        "biologico",
        "ergonomico",
        "acidente",
      ],
      rubric_base_calculo: ["salario_base", "percentual", "manual"],
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
    },
  },
} as const
