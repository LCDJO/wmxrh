
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);
