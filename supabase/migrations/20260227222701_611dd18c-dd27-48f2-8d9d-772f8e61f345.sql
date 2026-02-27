
-- Platform-level default footer configuration (managed by superadmins)
CREATE TABLE public.platform_footer_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_institutional boolean NOT NULL DEFAULT true,
  show_compliance boolean NOT NULL DEFAULT true,
  show_support boolean NOT NULL DEFAULT true,
  show_technical boolean NOT NULL DEFAULT true,
  show_bottom_text boolean NOT NULL DEFAULT true,
  custom_bottom_text text,
  support_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  compliance_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_footer_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform superadmins can manage footer defaults"
ON public.platform_footer_defaults
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_users pu
    JOIN public.platform_roles pr ON pr.id = pu.role_id
    WHERE pu.user_id = auth.uid()
    AND pr.name = 'platform_super_admin'
  )
);

INSERT INTO public.platform_footer_defaults (
  show_institutional, show_compliance, show_support, show_technical, show_bottom_text,
  custom_bottom_text, support_links, compliance_items
) VALUES (
  true, true, true, true, true,
  'Plataforma de Compliance Trabalhista e SST — Uso restrito a usuários autorizados.',
  '[{"label":"Central de Ajuda","href":"#"},{"label":"Documentação Técnica","href":"#"},{"label":"Política de Privacidade","href":"#"},{"label":"Termos de Uso","href":"#"},{"label":"Contato","href":"#"}]'::jsonb,
  '[{"text":"CLT — Consolidação das Leis do Trabalho"},{"text":"Normas Regulamentadoras (NR)"},{"text":"eSocial — Leiautes S-2.5+"}]'::jsonb
);

CREATE OR REPLACE FUNCTION public.auto_create_footer_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults RECORD;
BEGIN
  SELECT * INTO defaults FROM public.platform_footer_defaults LIMIT 1;
  IF defaults IS NOT NULL THEN
    INSERT INTO public.footer_configs (
      tenant_id, show_institutional, show_compliance, show_support,
      show_technical, show_bottom_text, custom_bottom_text,
      support_links, compliance_items
    ) VALUES (
      NEW.id, defaults.show_institutional, defaults.show_compliance,
      defaults.show_support, defaults.show_technical, defaults.show_bottom_text,
      defaults.custom_bottom_text, defaults.support_links, defaults.compliance_items
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_footer_config
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_footer_config();

CREATE TRIGGER update_platform_footer_defaults_updated_at
BEFORE UPDATE ON public.platform_footer_defaults
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
