
-- Add fraud review flag to tenant_plans
ALTER TABLE public.tenant_plans
  ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS review_flagged_at timestamptz;

-- Fraud detection logs
CREATE TABLE public.fraud_detection_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  detection_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  details jsonb DEFAULT '{}',
  action_taken text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_detection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view fraud logs"
  ON public.fraud_detection_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
    )
  );

CREATE INDEX idx_fraud_logs_tenant ON public.fraud_detection_logs(tenant_id, created_at DESC);
CREATE INDEX idx_fraud_logs_type ON public.fraud_detection_logs(detection_type, created_at DESC);

-- RPC: run fraud checks for a tenant
CREATE OR REPLACE FUNCTION public.check_tenant_fraud(p_tenant_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_signals jsonb := '[]'::jsonb;
  v_count integer;
  v_coupon_count integer;
  v_user_drop integer;
BEGIN
  -- 1. Plan cycling: multiple upgrades/downgrades in last 30 days
  SELECT count(*) INTO v_count
  FROM public.plan_change_history
  WHERE tenant_id = p_tenant_id
    AND changed_at > now() - interval '30 days';

  IF v_count >= 3 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'plan_cycling',
      'severity', CASE WHEN v_count >= 5 THEN 'critical' ELSE 'warning' END,
      'detail', format('%s mudanças de plano nos últimos 30 dias', v_count),
      'count', v_count
    );
  END IF;

  -- 2. Coupon abuse: multiple redemptions in last 60 days
  SELECT count(*) INTO v_coupon_count
  FROM public.coupon_redemptions
  WHERE tenant_id = p_tenant_id
    AND redeemed_at > now() - interval '60 days';

  IF v_coupon_count >= 3 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'coupon_abuse',
      'severity', CASE WHEN v_coupon_count >= 5 THEN 'critical' ELSE 'warning' END,
      'detail', format('%s cupons resgatados nos últimos 60 dias', v_coupon_count),
      'count', v_coupon_count
    );
  END IF;

  -- 3. Trial abuse: multiple trial periods
  SELECT count(*) INTO v_count
  FROM public.plan_change_history
  WHERE tenant_id = p_tenant_id
    AND new_status = 'trial';

  IF v_count >= 2 THEN
    v_signals := v_signals || jsonb_build_object(
      'type', 'trial_abuse',
      'severity', 'critical',
      'detail', format('Tenant entrou em trial %s vezes', v_count),
      'count', v_count
    );
  END IF;

  -- 4. User reduction before downgrade
  IF EXISTS (
    SELECT 1 FROM public.tenant_plans
    WHERE tenant_id = p_tenant_id AND downgrade_scheduled = true
  ) THEN
    SELECT count(*) INTO v_user_drop
    FROM public.employees
    WHERE tenant_id = p_tenant_id
      AND deleted_at IS NOT NULL
      AND deleted_at > now() - interval '7 days';

    IF v_user_drop >= 3 THEN
      v_signals := v_signals || jsonb_build_object(
        'type', 'user_reduction_before_downgrade',
        'severity', CASE WHEN v_user_drop >= 10 THEN 'critical' ELSE 'warning' END,
        'detail', format('%s usuários removidos nos últimos 7 dias com downgrade agendado', v_user_drop),
        'count', v_user_drop
      );
    END IF;
  END IF;

  -- Auto-flag if any critical signals
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_signals) s WHERE s->>'severity' = 'critical') THEN
    UPDATE public.tenant_plans
    SET review_required = true,
        review_reason = (SELECT string_agg(s->>'detail', '; ') FROM jsonb_array_elements(v_signals) s WHERE s->>'severity' = 'critical'),
        review_flagged_at = now()
    WHERE tenant_id = p_tenant_id AND status IN ('active', 'trial', 'past_due');
  END IF;

  RETURN v_signals;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
