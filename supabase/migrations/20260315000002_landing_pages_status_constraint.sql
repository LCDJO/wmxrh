-- ══════════════════════════════════════════════════════════════
-- Landing Pages — Corrigir CHECK constraint de status
--
-- Problema: a constraint original só permitia 'draft' e 'published',
-- mas o governance engine escreve 'pending_review' e 'approved'
-- durante o fluxo de aprovação — causando constraint violation.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.landing_pages
  DROP CONSTRAINT IF EXISTS landing_pages_status_check;

ALTER TABLE public.landing_pages
  ADD CONSTRAINT landing_pages_status_check
  CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'archived'));
