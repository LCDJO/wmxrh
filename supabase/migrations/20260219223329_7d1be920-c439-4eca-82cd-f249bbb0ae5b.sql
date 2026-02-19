
-- ══════════════════════════════════════════════════════════════
-- Integration Automation Engine — Database Schema
-- iPaaS-level workflow automation for the SaaS platform
-- ══════════════════════════════════════════════════════════════

-- 1) Integration Connectors Registry
CREATE TABLE public.integration_connectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  connector_type TEXT NOT NULL DEFAULT 'api' CHECK (connector_type IN ('api','webhook','internal_module','marketplace_app','database','event_stream')),
  icon_url TEXT,
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','api_key','oauth2','bearer','basic','custom')),
  auth_config JSONB NOT NULL DEFAULT '{}',
  base_url TEXT,
  available_actions JSONB NOT NULL DEFAULT '[]',
  available_triggers JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Tenant-specific connector configurations (credentials, etc.)
CREATE TABLE public.integration_connector_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  connector_id UUID NOT NULL REFERENCES public.integration_connectors(id),
  display_name TEXT NOT NULL,
  credentials_encrypted JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error','pending_auth')),
  last_tested_at TIMESTAMPTZ,
  test_result TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connector_id, display_name)
);

-- 3) Workflows (main definition)
CREATE TABLE public.integration_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived','error')),
  trigger_type TEXT NOT NULL DEFAULT 'event' CHECK (trigger_type IN ('event','schedule','webhook','manual','api')),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  current_version INTEGER NOT NULL DEFAULT 1,
  execution_count BIGINT NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  last_execution_result TEXT,
  error_count BIGINT NOT NULL DEFAULT 0,
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Workflow Versions (immutable snapshots)
CREATE TABLE public.integration_workflow_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.integration_workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  version_number INTEGER NOT NULL,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  change_summary TEXT,
  published_at TIMESTAMPTZ,
  published_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, version_number)
);

-- 5) Workflow Nodes (current draft nodes)
CREATE TABLE public.integration_workflow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.integration_workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  node_type TEXT NOT NULL CHECK (node_type IN ('trigger','action','condition','transform','delay','loop','error_handler','subworkflow','webhook_response')),
  connector_id UUID REFERENCES public.integration_connectors(id),
  connector_config_id UUID REFERENCES public.integration_connector_configs(id),
  label TEXT NOT NULL,
  description TEXT,
  action_key TEXT,
  input_config JSONB NOT NULL DEFAULT '{}',
  output_mapping JSONB NOT NULL DEFAULT '{}',
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  retry_config JSONB NOT NULL DEFAULT '{"max_retries":0,"backoff_ms":1000}',
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) Workflow Edges (connections between nodes)
CREATE TABLE public.integration_workflow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.integration_workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  source_node_id UUID NOT NULL REFERENCES public.integration_workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.integration_workflow_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'default' CHECK (edge_type IN ('default','success','failure','condition_true','condition_false','loop_body','error')),
  condition_expression TEXT,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) Workflow Executions (run history)
CREATE TABLE public.integration_workflow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.integration_workflows(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled','timeout')),
  trigger_type TEXT NOT NULL,
  trigger_payload JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  node_results JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  error_node_id UUID,
  retries_used INTEGER NOT NULL DEFAULT 0,
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  initiated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) Workflow Execution Node Logs (per-node execution detail)
CREATE TABLE public.integration_execution_node_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.integration_workflow_executions(id) ON DELETE CASCADE,
  node_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  retry_attempt INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) Workflow Usage Metering
CREATE TABLE public.integration_workflow_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  period_start DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily','monthly')),
  total_executions BIGINT NOT NULL DEFAULT 0,
  successful_executions BIGINT NOT NULL DEFAULT 0,
  failed_executions BIGINT NOT NULL DEFAULT 0,
  total_node_runs BIGINT NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  api_calls_external BIGINT NOT NULL DEFAULT 0,
  data_transferred_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_start, period_type)
);

-- ══════════════════════════════════════════════════════════════
-- Indexes
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_integration_connector_configs_tenant ON public.integration_connector_configs(tenant_id);
CREATE INDEX idx_integration_workflows_tenant ON public.integration_workflows(tenant_id);
CREATE INDEX idx_integration_workflows_status ON public.integration_workflows(tenant_id, status);
CREATE INDEX idx_integration_workflow_nodes_workflow ON public.integration_workflow_nodes(workflow_id);
CREATE INDEX idx_integration_workflow_edges_workflow ON public.integration_workflow_edges(workflow_id);
CREATE INDEX idx_integration_workflow_executions_workflow ON public.integration_workflow_executions(workflow_id);
CREATE INDEX idx_integration_workflow_executions_tenant ON public.integration_workflow_executions(tenant_id, created_at DESC);
CREATE INDEX idx_integration_execution_node_logs_exec ON public.integration_execution_node_logs(execution_id);
CREATE INDEX idx_integration_workflow_usage_tenant ON public.integration_workflow_usage(tenant_id, period_start);

-- ══════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.integration_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connector_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_execution_node_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_workflow_usage ENABLE ROW LEVEL SECURITY;

-- Connectors: readable by all authenticated, manageable by platform admins
CREATE POLICY "Connectors readable by authenticated" ON public.integration_connectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Connectors managed by platform admins" ON public.integration_connectors FOR ALL TO authenticated USING (is_active_platform_user(auth.uid()));

-- Connector configs: tenant-scoped
CREATE POLICY "Connector configs by tenant" ON public.integration_connector_configs FOR ALL TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));

-- Workflows: tenant-scoped
CREATE POLICY "Workflows by tenant" ON public.integration_workflows FOR ALL TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));

-- Workflow versions: tenant-scoped
CREATE POLICY "Workflow versions by tenant" ON public.integration_workflow_versions FOR ALL TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));

-- Workflow nodes: tenant-scoped
CREATE POLICY "Workflow nodes by tenant" ON public.integration_workflow_nodes FOR ALL TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));

-- Workflow edges: tenant-scoped
CREATE POLICY "Workflow edges by tenant" ON public.integration_workflow_edges FOR ALL TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));

-- Executions: tenant-scoped
CREATE POLICY "Executions by tenant" ON public.integration_workflow_executions FOR ALL TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));

-- Execution node logs: tenant-scoped
CREATE POLICY "Execution node logs by tenant" ON public.integration_execution_node_logs FOR ALL TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));

-- Usage: tenant-scoped + platform admins
CREATE POLICY "Usage by tenant" ON public.integration_workflow_usage FOR SELECT TO authenticated USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Usage managed by platform" ON public.integration_workflow_usage FOR ALL TO authenticated USING (is_active_platform_user(auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- Triggers
-- ══════════════════════════════════════════════════════════════

CREATE TRIGGER update_integration_connectors_updated_at BEFORE UPDATE ON public.integration_connectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_connector_configs_updated_at BEFORE UPDATE ON public.integration_connector_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_workflows_updated_at BEFORE UPDATE ON public.integration_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_workflow_nodes_updated_at BEFORE UPDATE ON public.integration_workflow_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_workflow_usage_updated_at BEFORE UPDATE ON public.integration_workflow_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- Seed system connectors
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.integration_connectors (name, slug, description, connector_type, auth_type, is_system, available_triggers, available_actions) VALUES
  ('Global Event Kernel', 'event-kernel', 'Eventos internos da plataforma via GlobalEventKernel', 'event_stream', 'none', true,
   '[{"key":"event.received","label":"Evento Recebido","config_fields":["event_type"]}]'::jsonb,
   '[{"key":"event.emit","label":"Emitir Evento","config_fields":["event_type","payload"]}]'::jsonb),
  ('HTTP / REST API', 'http-rest', 'Chamadas HTTP para APIs externas', 'api', 'custom', true,
   '[{"key":"webhook.received","label":"Webhook Recebido","config_fields":["path","method"]}]'::jsonb,
   '[{"key":"http.request","label":"Requisição HTTP","config_fields":["url","method","headers","body"]}]'::jsonb),
  ('Módulo Interno', 'internal-module', 'Interação com módulos internos da plataforma', 'internal_module', 'none', true,
   '[{"key":"module.event","label":"Evento de Módulo","config_fields":["module_key","event_type"]}]'::jsonb,
   '[{"key":"module.action","label":"Ação de Módulo","config_fields":["module_key","action_key","params"]}]'::jsonb),
  ('Marketplace App', 'marketplace-app', 'Integração com apps do Marketplace', 'marketplace_app', 'oauth2', true,
   '[{"key":"app.event","label":"Evento de App","config_fields":["app_id","event_type"]}]'::jsonb,
   '[{"key":"app.action","label":"Ação de App","config_fields":["app_id","action_key","params"]}]'::jsonb),
  ('Webhook', 'webhook', 'Receber e enviar webhooks', 'webhook', 'none', true,
   '[{"key":"webhook.incoming","label":"Webhook Recebido","config_fields":["path"]}]'::jsonb,
   '[{"key":"webhook.send","label":"Enviar Webhook","config_fields":["url","method","headers","body"]}]'::jsonb),
  ('Agendador (Cron)', 'scheduler', 'Execução agendada por cron expression', 'event_stream', 'none', true,
   '[{"key":"cron.tick","label":"Agendamento","config_fields":["cron_expression","timezone"]}]'::jsonb,
   '[]'::jsonb);
