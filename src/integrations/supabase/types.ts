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
      positions: {
        Row: {
          base_salary: number | null
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
      [_ in never]: never
    }
    Functions: {
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
