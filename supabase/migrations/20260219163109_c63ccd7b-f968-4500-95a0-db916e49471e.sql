
-- Drop existing policies that depend on tenant_id first
DROP POLICY IF EXISTS "Tenant admins manage api_keys" ON public.api_keys;

-- Drop indexes that depend on columns being removed
DROP INDEX IF EXISTS idx_api_keys_tenant;
DROP INDEX IF EXISTS idx_api_keys_prefix;

-- Remove columns not in spec
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS key_prefix;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS name;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS status;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS environment;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS last_used_at;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS last_used_ip;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS usage_count;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS rate_limit_override;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS revoked_at;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS revoked_by;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS revoked_reason;

-- Add rate_limit_plan
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS rate_limit_plan TEXT NOT NULL DEFAULT 'free';

-- RLS: keys managed through parent client
CREATE POLICY "Client owners manage api_keys"
  ON public.api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.api_clients ac
      WHERE ac.id = api_keys.client_id
      AND (
        (ac.tenant_id IS NOT NULL AND public.user_is_tenant_admin(auth.uid(), ac.tenant_id))
        OR public.is_active_platform_user(auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.api_clients ac
      WHERE ac.id = api_keys.client_id
      AND (
        (ac.tenant_id IS NOT NULL AND public.user_is_tenant_admin(auth.uid(), ac.tenant_id))
        OR public.is_active_platform_user(auth.uid())
      )
    )
  );

-- Update api_scopes to module.resource.action format
DELETE FROM public.api_scopes;

INSERT INTO public.api_scopes (code, name, description, category, risk_level, requires_approval) VALUES
  ('hr.employee.read',       'Read Employees',           'List and view employee data',          'hr',        'medium',   false),
  ('hr.employee.write',      'Write Employees',          'Create and update employee records',   'hr',        'high',     true),
  ('hr.employee.delete',     'Delete Employees',         'Remove employee records',              'hr',        'critical', true),
  ('hr.department.read',     'Read Departments',         'List departments',                     'hr',        'low',      false),
  ('hr.department.write',    'Write Departments',        'Manage departments',                   'hr',        'medium',   false),
  ('hr.position.read',       'Read Positions',           'List positions/roles',                 'hr',        'low',      false),
  ('hr.position.write',      'Write Positions',          'Manage positions',                     'hr',        'medium',   false),
  ('hr.health.read',         'Read Health Data',         'View occupational health records',     'hr',        'high',     true),
  ('hr.health.write',        'Write Health Data',        'Manage health records',                'hr',        'critical', true),
  ('compensation.salary.read',    'Read Salaries',       'View salary data',                    'compensation', 'high',   true),
  ('compensation.salary.write',   'Write Salaries',      'Modify salary data',                  'compensation', 'critical', true),
  ('compensation.benefit.read',   'Read Benefits',       'View benefits data',                  'compensation', 'medium', false),
  ('compensation.benefit.write',  'Write Benefits',      'Manage benefits',                     'compensation', 'high',   true),
  ('compensation.payroll.simulate','Simulate Payroll',   'Run payroll simulations',             'compensation', 'medium', false),
  ('billing.invoice.read',     'Read Invoices',          'View invoices',                       'billing',   'medium',   false),
  ('billing.invoice.write',    'Write Invoices',         'Manage invoices',                     'billing',   'high',     true),
  ('billing.subscription.read','Read Subscriptions',     'View subscription data',              'billing',   'medium',   false),
  ('billing.coupon.read',      'Read Coupons',           'View coupon data',                    'billing',   'low',      false),
  ('billing.coupon.write',     'Write Coupons',          'Manage coupons',                      'billing',   'high',     true),
  ('landing.page.read',       'Read Landing Pages',      'View landing page data',              'landing',   'low',      false),
  ('landing.page.write',      'Write Landing Pages',     'Edit landing pages',                  'landing',   'medium',   false),
  ('landing.publish',         'Publish Landing Pages',   'Publish landing pages live',           'landing',   'medium',   true),
  ('compliance.rule.read',    'Read Compliance Rules',   'View compliance configuration',       'compliance', 'medium',  false),
  ('compliance.violation.read','Read Violations',        'View compliance violations',          'compliance', 'high',    true),
  ('compliance.scan',         'Run Compliance Scan',     'Execute compliance scanning',         'compliance', 'medium',  false),
  ('api.client.read',         'Read API Clients',        'List API clients',                    'api',       'low',      false),
  ('api.client.write',        'Write API Clients',       'Manage API clients',                  'api',       'high',     true),
  ('api.key.read',            'Read API Keys',           'List API keys (masked)',              'api',       'medium',   false),
  ('api.key.write',           'Write API Keys',          'Generate and revoke API keys',        'api',       'critical', true),
  ('api.usage.read',          'Read API Usage',          'View API usage analytics',            'api',       'low',      false),
  ('webhook.config.read',     'Read Webhook Config',     'View webhook configurations',         'webhook',   'low',      false),
  ('webhook.config.write',    'Write Webhook Config',    'Manage webhook endpoints',            'webhook',   'high',     true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level,
  requires_approval = EXCLUDED.requires_approval;
