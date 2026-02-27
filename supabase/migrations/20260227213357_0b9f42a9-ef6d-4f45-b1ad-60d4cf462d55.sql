
-- Drop old enums and recreate with user-specified values
-- First drop dependent columns' defaults and constraints

-- Update severity enum: critical→sev1, high→sev2, medium→sev3, low→sev4, remove info
ALTER TYPE public.incident_severity RENAME TO incident_severity_old;
CREATE TYPE public.incident_severity AS ENUM ('sev1', 'sev2', 'sev3', 'sev4');

ALTER TABLE public.incidents
  ALTER COLUMN severity DROP DEFAULT,
  ALTER COLUMN severity TYPE public.incident_severity USING (
    CASE severity::text
      WHEN 'critical' THEN 'sev1'
      WHEN 'high' THEN 'sev2'
      WHEN 'medium' THEN 'sev3'
      WHEN 'low' THEN 'sev4'
      WHEN 'info' THEN 'sev4'
    END
  )::public.incident_severity,
  ALTER COLUMN severity SET DEFAULT 'sev3';

ALTER TABLE public.incident_sla_configs
  ALTER COLUMN severity TYPE public.incident_severity USING (
    CASE severity::text
      WHEN 'critical' THEN 'sev1'
      WHEN 'high' THEN 'sev2'
      WHEN 'medium' THEN 'sev3'
      WHEN 'low' THEN 'sev4'
      WHEN 'info' THEN 'sev4'
    END
  )::public.incident_severity;

DROP TYPE public.incident_severity_old;

-- Update status enum
ALTER TYPE public.incident_status RENAME TO incident_status_old;
CREATE TYPE public.incident_status AS ENUM ('open', 'investigating', 'mitigated', 'resolved');

ALTER TABLE public.incidents
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.incident_status USING (
    CASE status::text
      WHEN 'detected' THEN 'open'
      WHEN 'investigating' THEN 'investigating'
      WHEN 'identified' THEN 'investigating'
      WHEN 'monitoring' THEN 'mitigated'
      WHEN 'resolved' THEN 'resolved'
      WHEN 'postmortem' THEN 'resolved'
      WHEN 'closed' THEN 'resolved'
    END
  )::public.incident_status,
  ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE public.incident_updates
  ALTER COLUMN previous_status TYPE public.incident_status USING (
    CASE previous_status::text
      WHEN 'detected' THEN 'open'
      WHEN 'investigating' THEN 'investigating'
      WHEN 'identified' THEN 'investigating'
      WHEN 'monitoring' THEN 'mitigated'
      WHEN 'resolved' THEN 'resolved'
      WHEN 'postmortem' THEN 'resolved'
      WHEN 'closed' THEN 'resolved'
      ELSE NULL
    END
  )::public.incident_status;

ALTER TABLE public.incident_updates
  ALTER COLUMN new_status TYPE public.incident_status USING (
    CASE new_status::text
      WHEN 'detected' THEN 'open'
      WHEN 'investigating' THEN 'investigating'
      WHEN 'identified' THEN 'investigating'
      WHEN 'monitoring' THEN 'mitigated'
      WHEN 'resolved' THEN 'resolved'
      WHEN 'postmortem' THEN 'resolved'
      WHEN 'closed' THEN 'resolved'
      ELSE NULL
    END
  )::public.incident_status;

DROP TYPE public.incident_status_old;

-- Add module_id and affected_tenants columns
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS module_id TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS affected_tenants UUID[] DEFAULT '{}';

-- Update SLA defaults to new severity names
UPDATE public.incident_sla_configs SET severity = 'sev1' WHERE severity = 'sev1';
DELETE FROM public.incident_sla_configs WHERE severity = 'sev4' AND tenant_id IS NULL AND id IN (
  SELECT id FROM public.incident_sla_configs WHERE severity = 'sev4' AND tenant_id IS NULL ORDER BY created_at OFFSET 1
);
