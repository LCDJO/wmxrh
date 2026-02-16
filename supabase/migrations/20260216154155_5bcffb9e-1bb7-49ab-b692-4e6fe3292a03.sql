
-- ══════════════════════════════════════════════════════════
-- eSocial Event Queue — tracks all government integration events
-- Covers: S-1000, S-2200, S-2300, SST events, GFIP, FGTS
-- ══════════════════════════════════════════════════════════

-- Event status lifecycle: pending → processing → sent → accepted / rejected / error
CREATE TYPE public.esocial_event_status AS ENUM ('pending', 'processing', 'sent', 'accepted', 'rejected', 'error', 'cancelled');

-- Event category groups
CREATE TYPE public.esocial_event_category AS ENUM (
  'tabelas',        -- S-1000 a S-1080 (employer, positions, schedules)
  'nao_periodicos', -- S-2200, S-2205, S-2206, S-2299, S-2300 (hire, termination, salary change)
  'periodicos',     -- S-1200, S-1210, S-1299 (payroll, payments, closing)
  'sst',            -- S-2210, S-2220, S-2240 (CAT, ASO, risk conditions)
  'gfip_fgts'       -- GFIP/SEFIP, FGTS Digital
);

CREATE TABLE public.esocial_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),

  -- Event identification
  event_type TEXT NOT NULL,              -- e.g. 'S-2200', 'S-1200', 'GFIP'
  category esocial_event_category NOT NULL,
  receipt_number TEXT,                   -- Número do recibo do governo

  -- Linked entity
  entity_type TEXT,                      -- 'employee', 'company', 'risk_exposure', etc.
  entity_id UUID,                        -- ID of the related record

  -- Status
  status esocial_event_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- Payload (XML or JSON representation ready for transformation)
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,

  -- Reference dates
  reference_period TEXT,                 -- e.g. '2026-01' for monthly events
  effective_date DATE,                   -- When the event takes effect

  -- Metadata
  created_by UUID,
  processed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_esocial_events_tenant ON public.esocial_events(tenant_id);
CREATE INDEX idx_esocial_events_status ON public.esocial_events(tenant_id, status);
CREATE INDEX idx_esocial_events_type ON public.esocial_events(tenant_id, event_type);
CREATE INDEX idx_esocial_events_entity ON public.esocial_events(entity_type, entity_id);
CREATE INDEX idx_esocial_events_period ON public.esocial_events(tenant_id, reference_period);

-- Enable RLS
ALTER TABLE public.esocial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view esocial events"
  ON public.esocial_events FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage esocial events"
  ON public.esocial_events FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Auto-update timestamp
CREATE TRIGGER update_esocial_events_updated_at
  BEFORE UPDATE ON public.esocial_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trail
CREATE TRIGGER trg_audit_esocial_events
  AFTER INSERT OR UPDATE OR DELETE ON public.esocial_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- ══════════════════════════════════════════════════════════
-- eSocial Event Mapping — maps internal events to eSocial codes
-- This acts as a configuration table for the future integration
-- ══════════════════════════════════════════════════════════

CREATE TABLE public.esocial_event_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),

  -- Internal trigger
  trigger_table TEXT NOT NULL,           -- e.g. 'employees', 'salary_contracts'
  trigger_action TEXT NOT NULL,          -- 'insert', 'update', 'delete'
  trigger_conditions JSONB,             -- Optional: conditions to filter (e.g. {"status": "active"})

  -- eSocial mapping
  esocial_event_type TEXT NOT NULL,      -- e.g. 'S-2200'
  category esocial_event_category NOT NULL,
  description TEXT,

  -- Configuration
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_generate BOOLEAN NOT NULL DEFAULT false,  -- Whether to auto-create event on trigger
  payload_template JSONB,                        -- Template for building the payload

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, trigger_table, trigger_action, esocial_event_type)
);

ALTER TABLE public.esocial_event_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage event mappings"
  ON public.esocial_event_mappings FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Seed default mappings (informational — auto_generate=false for now)
CREATE OR REPLACE FUNCTION public.seed_esocial_mappings(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.esocial_event_mappings (tenant_id, trigger_table, trigger_action, esocial_event_type, category, description)
  VALUES
    -- Tabelas (S-1000)
    (_tenant_id, 'companies', 'insert', 'S-1000', 'tabelas', 'Informações do Empregador/Contribuinte'),
    (_tenant_id, 'positions', 'insert', 'S-1030', 'tabelas', 'Tabela de Cargos/Empregos Públicos'),
    -- Não periódicos
    (_tenant_id, 'employees', 'insert', 'S-2200', 'nao_periodicos', 'Cadastramento Inicial / Admissão do Trabalhador'),
    (_tenant_id, 'employees', 'update', 'S-2205', 'nao_periodicos', 'Alteração de Dados Cadastrais do Trabalhador'),
    (_tenant_id, 'salary_contracts', 'insert', 'S-2206', 'nao_periodicos', 'Alteração de Contrato de Trabalho'),
    (_tenant_id, 'salary_adjustments', 'insert', 'S-2206', 'nao_periodicos', 'Reajuste Salarial — Alteração Contratual'),
    -- SST
    (_tenant_id, 'employee_health_exams', 'insert', 'S-2220', 'sst', 'Monitoramento da Saúde do Trabalhador (ASO)'),
    (_tenant_id, 'employee_risk_exposures', 'insert', 'S-2240', 'sst', 'Condições Ambientais do Trabalho — Agentes Nocivos'),
    -- Periódicos / GFIP
    (_tenant_id, 'salary_contracts', 'insert', 'GFIP', 'gfip_fgts', 'Guia de Recolhimento do FGTS e Informações à Previdência')
  ON CONFLICT (tenant_id, trigger_table, trigger_action, esocial_event_type) DO NOTHING;
END;
$$;

-- Auto-seed on tenant creation
CREATE OR REPLACE FUNCTION public.auto_seed_esocial_mappings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.seed_esocial_mappings(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_seed_esocial
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.auto_seed_esocial_mappings();
