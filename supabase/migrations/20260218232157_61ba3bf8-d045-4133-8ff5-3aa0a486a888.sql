-- Fix overly permissive storage RLS on signed-documents bucket
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Users can view signed documents in their tenant folder" ON storage.objects;

-- Create proper tenant-scoped read policy
CREATE POLICY "Tenant members can read their signed docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'signed-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.tenant_memberships WHERE user_id = auth.uid()
    )
  );
