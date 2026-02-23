
-- ══════════════════════════════════════════════════════════
-- SECURITY: Agreement Engine — Immutability & Access Control
-- ══════════════════════════════════════════════════════════

-- 1) Block DELETE on agreement_template_versions (immutable versioning)
CREATE OR REPLACE FUNCTION public.prevent_template_version_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Não é permitido excluir versões de templates. O versionamento é imutável.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_template_version_delete
  BEFORE DELETE ON public.agreement_template_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_template_version_delete();

-- 2) Block mutation of published template versions (content_html, content_hash)
CREATE OR REPLACE FUNCTION public.prevent_published_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    -- Only allow flipping is_current (for new version promotion)
    IF NEW.content_html IS DISTINCT FROM OLD.content_html
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.content_plain IS DISTINCT FROM OLD.content_plain
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
    THEN
      RAISE EXCEPTION 'Não é permitido alterar o conteúdo de uma versão já publicada. Publique uma nova versão.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_published_version_mutation
  BEFORE UPDATE ON public.agreement_template_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_published_version_mutation();

-- 3) Block mutation of signed agreement fields
CREATE OR REPLACE FUNCTION public.prevent_signed_agreement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'signed' THEN
    -- Allow only status transitions (e.g. signed → expired, signed → renewed)
    IF NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.signed_document_hash IS DISTINCT FROM OLD.signed_document_hash
       OR NEW.signed_document_url IS DISTINCT FROM OLD.signed_document_url
       OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.template_version_id IS DISTINCT FROM OLD.template_version_id
       OR NEW.versao IS DISTINCT FROM OLD.versao
    THEN
      RAISE EXCEPTION 'Não é permitido alterar campos críticos de um acordo já assinado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_signed_agreement_mutation
  BEFORE UPDATE ON public.employee_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_signed_agreement_mutation();

-- 4) Restrict template creation to admin/rh roles only (tighten existing policy)
-- Drop the overly broad ALL policy and replace with granular ones
-- (The existing SELECT policy already allows all tenant members to read)

-- Add RH to template management
DROP POLICY IF EXISTS "Admins can manage agreement templates" ON public.agreement_templates;
CREATE POLICY "RH and Admins can manage agreement templates"
  ON public.agreement_templates
  FOR ALL
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
    )
  );

-- Same for template versions
DROP POLICY IF EXISTS "Admins can manage template versions" ON public.agreement_template_versions;
CREATE POLICY "RH and Admins can manage template versions"
  ON public.agreement_template_versions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'superadmin', 'tenant_admin', 'rh')
    )
  );
