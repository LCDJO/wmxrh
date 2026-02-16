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
      audit_logs: {
        Row: {
          action: string
          company_group_id: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_group_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
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
          metadata: Json | null
          notes: string | null
          registration_number: string | null
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
          metadata?: Json | null
          notes?: string | null
          registration_number?: string | null
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
          metadata?: Json | null
          notes?: string | null
          registration_number?: string | null
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
          phone: string | null
          position_id: string | null
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
          phone?: string | null
          position_id?: string | null
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
          phone?: string | null
          position_id?: string | null
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
      labor_rule_definitions: {
        Row: {
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
          integra_ferias: boolean
          integra_fgts: boolean
          integra_inss: boolean
          integra_irrf: boolean
          is_active: boolean
          is_mandatory: boolean
          legal_basis: string | null
          name: string
          priority: number
          rule_set_id: string
          tenant_id: string
          tiered_config: Json | null
          updated_at: string
        }
        Insert: {
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
          integra_ferias?: boolean
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          is_active?: boolean
          is_mandatory?: boolean
          legal_basis?: string | null
          name: string
          priority?: number
          rule_set_id: string
          tenant_id: string
          tiered_config?: Json | null
          updated_at?: string
        }
        Update: {
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
          integra_ferias?: boolean
          integra_fgts?: boolean
          integra_inss?: boolean
          integra_irrf?: boolean
          is_active?: boolean
          is_mandatory?: boolean
          legal_basis?: string | null
          name?: string
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
          union_code: string | null
          union_name: string | null
          updated_at: string
        }
        Insert: {
          base_monthly_hours?: number
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
          union_code?: string | null
          union_name?: string | null
          updated_at?: string
        }
        Update: {
          base_monthly_hours?: number
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
          created_at: string
          id: string
          ip_address: string | null
          request_id: string | null
          resource: string
          result: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          request_id?: string | null
          resource: string
          result: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
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
      tenant_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
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
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
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
      user_is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      benefit_type: "va" | "vr" | "vt" | "health" | "dental" | "cesta" | "flex"
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
      benefit_type: ["va", "vr", "vt", "health", "dental", "cesta", "flex"],
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
