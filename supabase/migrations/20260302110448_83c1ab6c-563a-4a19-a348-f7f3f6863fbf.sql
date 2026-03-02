
-- Add missing columns to biometric_enrollments
ALTER TABLE public.biometric_enrollments
  ADD COLUMN IF NOT EXISTS encrypted_template text,
  ADD COLUMN IF NOT EXISTS consent_version_id uuid REFERENCES public.platform_policy_versions(id);

-- Index for consent version lookups
CREATE INDEX IF NOT EXISTS idx_biometric_enroll_consent_ver ON public.biometric_enrollments(consent_version_id);
