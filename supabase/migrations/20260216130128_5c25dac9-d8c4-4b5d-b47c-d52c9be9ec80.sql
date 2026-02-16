
-- =============================================
-- SOFT DELETE: Add deleted_at to all main entities
-- =============================================

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.company_groups ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.salary_contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.salary_adjustments ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.salary_additionals ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.salary_history ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- =============================================
-- SCOPE COLUMNS: Add company_group_id / company_id where missing
-- =============================================

-- Departments: add company_group_id
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS company_group_id uuid REFERENCES public.company_groups(id) DEFAULT NULL;

-- Positions: add company_group_id
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS company_group_id uuid REFERENCES public.company_groups(id) DEFAULT NULL;

-- Salary contracts: add company_group_id and company_id
ALTER TABLE public.salary_contracts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT NULL;
ALTER TABLE public.salary_contracts ADD COLUMN IF NOT EXISTS company_group_id uuid REFERENCES public.company_groups(id) DEFAULT NULL;

-- Salary adjustments: add company_group_id and company_id
ALTER TABLE public.salary_adjustments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT NULL;
ALTER TABLE public.salary_adjustments ADD COLUMN IF NOT EXISTS company_group_id uuid REFERENCES public.company_groups(id) DEFAULT NULL;

-- Salary additionals: add company_group_id and company_id
ALTER TABLE public.salary_additionals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT NULL;
ALTER TABLE public.salary_additionals ADD COLUMN IF NOT EXISTS company_group_id uuid REFERENCES public.company_groups(id) DEFAULT NULL;

-- Salary history: add company_group_id and company_id
ALTER TABLE public.salary_history ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) DEFAULT NULL;
ALTER TABLE public.salary_history ADD COLUMN IF NOT EXISTS company_group_id uuid REFERENCES public.company_groups(id) DEFAULT NULL;

-- =============================================
-- INDEXES for soft delete and scope filtering
-- =============================================

CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON public.employees(deleted_at);
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON public.companies(deleted_at);
CREATE INDEX IF NOT EXISTS idx_company_groups_deleted_at ON public.company_groups(deleted_at);
CREATE INDEX IF NOT EXISTS idx_departments_deleted_at ON public.departments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_positions_deleted_at ON public.positions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_salary_contracts_deleted_at ON public.salary_contracts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_departments_group ON public.departments(company_group_id);
CREATE INDEX IF NOT EXISTS idx_positions_group ON public.positions(company_group_id);
CREATE INDEX IF NOT EXISTS idx_salary_contracts_company ON public.salary_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_contracts_group ON public.salary_contracts(company_group_id);

-- =============================================
-- SOFT DELETE FUNCTION (reusable)
-- =============================================

CREATE OR REPLACE FUNCTION public.soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.deleted_at = now();
  RETURN NEW;
END;
$$;
