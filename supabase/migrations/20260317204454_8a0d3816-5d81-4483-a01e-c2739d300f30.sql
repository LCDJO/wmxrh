-- Fix overly permissive ads metrics insert policy introduced for the ads platform
DROP POLICY IF EXISTS "Authenticated users can insert metrics" ON public.ads_metrics;

CREATE POLICY "Authenticated users insert scoped ads metrics"
ON public.ads_metrics
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id IS NULL
    OR user_id = auth.uid()
  )
  AND (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = ads_metrics.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
    )
  )
);