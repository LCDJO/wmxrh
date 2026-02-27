
-- ══════════════════════════════════════════════════════
-- Enterprise Incident Management System — Schema
-- ══════════════════════════════════════════════════════

-- Severity enum
CREATE TYPE public.incident_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- Incident status enum
CREATE TYPE public.incident_status AS ENUM (
  'detected', 'investigating', 'identified', 'monitoring', 'resolved', 'postmortem', 'closed'
);

-- Escalation level enum
CREATE TYPE public.escalation_level AS ENUM ('l1', 'l2', 'l3', 'management', 'executive');

-- ── SLA Configurations ──────────────────────────────
CREATE TABLE public.incident_sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  severity incident_severity NOT NULL,
  response_time_minutes INT NOT NULL DEFAULT 15,
  acknowledgement_time_minutes INT NOT NULL DEFAULT 30,
  resolution_time_minutes INT NOT NULL DEFAULT 240,
  escalation_after_minutes INT NOT NULL DEFAULT 60,
  notification_interval_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, severity)
);

-- Global defaults (tenant_id = NULL)
INSERT INTO public.incident_sla_configs (tenant_id, severity, response_time_minutes, acknowledgement_time_minutes, resolution_time_minutes, escalation_after_minutes)
VALUES
  (NULL, 'critical', 5, 15, 60, 15),
  (NULL, 'high', 15, 30, 240, 60),
  (NULL, 'medium', 30, 60, 480, 120),
  (NULL, 'low', 60, 120, 1440, 480),
  (NULL, 'info', 120, 240, 2880, 1440);

-- ── Incidents ───────────────────────────────────────
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity incident_severity NOT NULL DEFAULT 'medium',
  status incident_status NOT NULL DEFAULT 'detected',
  source TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  affected_modules TEXT[] DEFAULT '{}',
  affected_services TEXT[] DEFAULT '{}',
  impact_description TEXT,
  root_cause TEXT,
  resolution_summary TEXT,
  assigned_to UUID,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  escalation_level escalation_level NOT NULL DEFAULT 'l1',
  sla_response_deadline TIMESTAMPTZ,
  sla_ack_deadline TIMESTAMPTZ,
  sla_resolution_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_tenant_status ON public.incidents(tenant_id, status);
CREATE INDEX idx_incidents_severity ON public.incidents(severity);
CREATE INDEX idx_incidents_created ON public.incidents(created_at DESC);

-- ── Incident Timeline / Updates ─────────────────────
CREATE TABLE public.incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  author_id UUID,
  update_type TEXT NOT NULL DEFAULT 'status_change',
  previous_status incident_status,
  new_status incident_status,
  message TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_updates_incident ON public.incident_updates(incident_id, created_at);

-- ── Escalation History ──────────────────────────────
CREATE TABLE public.incident_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  from_level escalation_level NOT NULL,
  to_level escalation_level NOT NULL,
  reason TEXT NOT NULL,
  escalated_by UUID,
  auto_escalated BOOLEAN NOT NULL DEFAULT false,
  notified_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Client Notifications ────────────────────────────
CREATE TABLE public.incident_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  channel TEXT NOT NULL DEFAULT 'email',
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Status Page Components ──────────────────────────
CREATE TABLE public.status_page_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  component_group TEXT,
  display_order INT NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'operational',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Status Page Incidents (public-facing) ───────────
CREATE TABLE public.status_page_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  impact TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'investigating',
  affected_components UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Postmortems ─────────────────────────────────────
CREATE TABLE public.incident_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID REFERENCES public.tenants(id),
  summary TEXT NOT NULL,
  timeline_events JSONB DEFAULT '[]',
  root_cause_analysis TEXT,
  contributing_factors TEXT[] DEFAULT '{}',
  action_items JSONB DEFAULT '[]',
  lessons_learned TEXT,
  impact_duration_minutes INT,
  affected_users_count INT,
  revenue_impact_estimate NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Availability Records ────────────────────────────
CREATE TABLE public.availability_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  component_id UUID REFERENCES public.status_page_components(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'daily',
  total_minutes INT NOT NULL DEFAULT 1440,
  downtime_minutes INT NOT NULL DEFAULT 0,
  uptime_percentage NUMERIC(6,3) NOT NULL DEFAULT 100.000,
  incident_count INT NOT NULL DEFAULT 0,
  sla_target_percentage NUMERIC(6,3) NOT NULL DEFAULT 99.900,
  sla_met BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_availability_period ON public.availability_records(tenant_id, period_start DESC);

-- ── RLS ─────────────────────────────────────────────
ALTER TABLE public.incident_sla_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_page_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_page_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_postmortems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_records ENABLE ROW LEVEL SECURITY;

-- Global SLA configs readable by all authenticated
CREATE POLICY "SLA configs readable by authenticated" ON public.incident_sla_configs
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Incidents: platform users and tenant members
CREATE POLICY "Incidents viewable by tenant members" ON public.incidents
  FOR SELECT TO authenticated USING (
    tenant_id IS NULL OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    ) OR EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

CREATE POLICY "Incidents manageable by platform users" ON public.incidents
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

-- Updates follow incident access
CREATE POLICY "Updates viewable by tenant members" ON public.incident_updates
  FOR SELECT TO authenticated USING (
    incident_id IN (SELECT id FROM public.incidents WHERE tenant_id IS NULL OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    )) OR EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

CREATE POLICY "Updates manageable by platform users" ON public.incident_updates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

-- Escalations: platform users only
CREATE POLICY "Escalations platform access" ON public.incident_escalations
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

-- Notifications: platform users only
CREATE POLICY "Notifications platform access" ON public.incident_notifications
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

-- Status page components: public read for tenant, platform write
CREATE POLICY "Status components public read" ON public.status_page_components
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Status components platform write" ON public.status_page_components
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

-- Status page incidents: public read
CREATE POLICY "Status incidents public read" ON public.status_page_incidents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Status incidents platform write" ON public.status_page_incidents
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

-- Postmortems: platform users
CREATE POLICY "Postmortems platform access" ON public.incident_postmortems
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

CREATE POLICY "Postmortems tenant read" ON public.incident_postmortems
  FOR SELECT TO authenticated USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() AND status = 'active'
    ) AND status = 'published'
  );

-- Availability: public read
CREATE POLICY "Availability public read" ON public.availability_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Availability platform write" ON public.availability_records
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.platform_users WHERE id = auth.uid())
  );

-- Updated_at triggers
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_incident_sla_configs_updated_at BEFORE UPDATE ON public.incident_sla_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_status_page_components_updated_at BEFORE UPDATE ON public.status_page_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_status_page_incidents_updated_at BEFORE UPDATE ON public.status_page_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_incident_postmortems_updated_at BEFORE UPDATE ON public.incident_postmortems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
